import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, StatScope } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreatePlayerDto, PlayerSearchQueryDto, UpdatePlayerDto } from "@3x3/shared";

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: PlayerSearchQueryDto) {
    const where: Prisma.PlayerWhereInput = {};
    if (query.clubId) {
      where.homeClubId = query.clubId;
    }
    if (query.city) {
      where.homeClub = { city: { contains: query.city, mode: "insensitive" } };
    }

    const dobFilter: Prisma.DateTimeFilter = {};
    const now = new Date();
    // age >= minAge  <=>  dateOfBirth <= (now - minAge years)
    if (query.minAge !== undefined) {
      dobFilter.lte = shiftYears(now, -query.minAge);
    }
    // age <= maxAge  <=>  dateOfBirth > (now - (maxAge + 1) years)
    if (query.maxAge !== undefined) {
      dobFilter.gt = shiftYears(now, -(query.maxAge + 1));
    }
    if (Object.keys(dobFilter).length > 0) {
      where.dateOfBirth = dobFilter;
    }

    const players = await this.prisma.player.findMany({
      where,
      include: { homeClub: { select: { id: true, name: true, city: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    if (query.minPpg === undefined && query.maxPpg === undefined) {
      return players;
    }

    // PPG is a derived ratio (CAREER points / gamesPlayed), not a stored column, so this
    // filters in the service layer rather than fighting Prisma's query builder for it —
    // fine at this data scale, a deliberate simplicity-over-cleverness call.
    const careerRows = await this.prisma.statSnapshot.findMany({
      where: { scopeType: StatScope.CAREER, playerId: { in: players.map((p) => p.id) } },
    });
    const ppgByPlayerId = new Map(
      careerRows.map((row) => [row.playerId as string, row.gamesPlayed > 0 ? row.points / row.gamesPlayed : 0])
    );

    return players.filter((player) => {
      // No CAREER row yet (never played in a locked match) counts as 0 PPG.
      const ppg = ppgByPlayerId.get(player.id) ?? 0;
      if (query.minPpg !== undefined && ppg < query.minPpg) return false;
      if (query.maxPpg !== undefined && ppg > query.maxPpg) return false;
      return true;
    });
  }

  async findOne(playerId: string) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: { homeClub: { select: { id: true, name: true, city: true } } },
    });
    if (!player) {
      throw new NotFoundException("Player not found.");
    }
    return player;
  }

  async create(user: AuthenticatedUser, dto: CreatePlayerDto) {
    this.assertIsAdmin(user);
    return this.prisma.player.create({ data: dto });
  }

  async update(user: AuthenticatedUser, playerId: string, dto: UpdatePlayerDto) {
    this.assertIsAdmin(user);
    const player = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      throw new NotFoundException("Player not found.");
    }
    return this.prisma.player.update({ where: { id: playerId }, data: dto });
  }

  async remove(user: AuthenticatedUser, playerId: string) {
    this.assertIsAdmin(user);
    const player = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      throw new NotFoundException("Player not found.");
    }
    await this.prisma.player.delete({ where: { id: playerId } });
  }

  // Player master-record management (name/DOB/height/etc., separate from roster assignment)
  // is Admin-only — see PROGRESS.md's RBAC overhaul note. Deliberately checks
  // `user.isSuperadmin` directly rather than `clubContext.accessibleClubIds === "ALL"`,
  // because that sentinel is also true for a Scout (read-only widening, see
  // ClubScopeGuard) — a Scout must NOT get player-record write access as a side effect.
  // Reads (search/findOne) stay fully open, unaffected.
  private assertIsAdmin(user: AuthenticatedUser) {
    if (!user.isSuperadmin) {
      throw new ForbiddenException("Only an Admin can manage player records.");
    }
  }
}

function shiftYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}
