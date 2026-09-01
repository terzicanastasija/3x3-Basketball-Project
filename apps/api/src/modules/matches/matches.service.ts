import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { MatchStatus } from "@3x3/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser } from "../../common/types/authenticated-request";
import { CreateMatchDto, RecordMatchResultDto, UpdateMatchDto } from "@3x3/shared";

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  // Reads are open — same cross-club-discovery spirit as tournaments/players.
  listForTournament(tournamentId: string) {
    return this.prisma.match.findMany({
      where: { tournamentId },
      orderBy: { scheduledAt: "asc" },
    });
  }

  async findOne(matchId: string) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      throw new NotFoundException("Match not found.");
    }
    return match;
  }

  async create(user: AuthenticatedUser, tournamentId: string, dto: CreateMatchDto) {
    this.assertIsAdmin(user);
    const [homeTeam, awayTeam] = await Promise.all([
      this.prisma.team.findUnique({ where: { id: dto.homeTeamId }, select: { id: true } }),
      this.prisma.team.findUnique({ where: { id: dto.awayTeamId }, select: { id: true } }),
    ]);
    if (!homeTeam || !awayTeam) {
      throw new NotFoundException("Home or away team not found.");
    }

    return this.prisma.match.create({
      data: {
        tournamentId,
        homeTeamId: dto.homeTeamId,
        awayTeamId: dto.awayTeamId,
        phase: dto.phase,
        scheduledAt: dto.scheduledAt,
        createdById: user.id,
      },
    });
  }

  async update(user: AuthenticatedUser, matchId: string, dto: UpdateMatchDto) {
    await this.ensureEditable(user, matchId);
    return this.prisma.match.update({ where: { id: matchId }, data: dto });
  }

  async recordResult(user: AuthenticatedUser, matchId: string, dto: RecordMatchResultDto) {
    await this.ensureEditable(user, matchId);
    return this.prisma.match.update({
      where: { id: matchId },
      data: {
        homeScore: dto.homeScore,
        awayScore: dto.awayScore,
        endType: dto.endType,
        homeTeamFouls: dto.homeTeamFouls,
        awayTeamFouls: dto.awayTeamFouls,
        status: MatchStatus.PLAYED,
      },
    });
  }

  async remove(user: AuthenticatedUser, matchId: string) {
    // Only an Admin ever reaches this point (ensureEditable enforces it below), so — same as
    // before this RBAC overhaul — a played match's deletion isn't blocked here: the Admin
    // retains that override for genuine cleanup (e.g. a duplicate/mistaken match). Everyone
    // else is already rejected by ensureEditable before this line matters at all.
    await this.ensureEditable(user, matchId);
    await this.prisma.match.delete({ where: { id: matchId } });
  }

  private async ensureEditable(user: AuthenticatedUser, matchId: string) {
    this.assertIsAdmin(user);
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) {
      throw new NotFoundException("Match not found.");
    }
    return match;
  }

  // Match management (create/edit/schedule/delete) is Admin-only — see PROGRESS.md's RBAC
  // overhaul note for why this is no longer shared with CLUB_ADMIN/COACH.
  private assertIsAdmin(user: AuthenticatedUser) {
    if (!user.isSuperadmin) {
      throw new ForbiddenException("Only an Admin can manage matches.");
    }
  }
}
