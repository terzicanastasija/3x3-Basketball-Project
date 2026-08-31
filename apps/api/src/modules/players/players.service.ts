import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Role } from "@3x3/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { ClubContext } from "../../common/types/authenticated-request";
import { CreatePlayerDto, PlayerSearchQueryDto, UpdatePlayerDto } from "@3x3/shared";

const EDIT_ROLES: Role[] = [Role.CLUB_ADMIN, Role.COACH];

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

    return this.prisma.player.findMany({
      where,
      include: { homeClub: { select: { id: true, name: true, city: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
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

  async create(dto: CreatePlayerDto, clubContext: ClubContext) {
    this.assertCanEditClub(dto.homeClubId, clubContext);
    return this.prisma.player.create({ data: dto });
  }

  async update(playerId: string, dto: UpdatePlayerDto, clubContext: ClubContext) {
    const player = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      throw new NotFoundException("Player not found.");
    }
    this.assertCanEditPlayer(player.homeClubId, clubContext);
    return this.prisma.player.update({ where: { id: playerId }, data: dto });
  }

  async remove(playerId: string, clubContext: ClubContext) {
    const player = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      throw new NotFoundException("Player not found.");
    }
    this.assertCanEditPlayer(player.homeClubId, clubContext);
    await this.prisma.player.delete({ where: { id: playerId } });
  }

  private assertCanEditPlayer(homeClubId: string | null, clubContext: ClubContext) {
    if (!homeClubId) {
      // No home club to check a role against — only superadmin (accessibleClubIds === "ALL") may edit.
      if (clubContext.accessibleClubIds !== "ALL") {
        throw new ForbiddenException("Only a superadmin can edit a player with no home club.");
      }
      return;
    }
    this.assertCanEditClub(homeClubId, clubContext);
  }

  private assertCanEditClub(clubId: string, clubContext: ClubContext) {
    if (clubContext.accessibleClubIds === "ALL") return;
    const role = clubContext.roleByClubId[clubId];
    if (!role || !EDIT_ROLES.includes(role)) {
      throw new ForbiddenException("You must be a club admin or coach of this player's club.");
    }
  }
}

function shiftYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}
