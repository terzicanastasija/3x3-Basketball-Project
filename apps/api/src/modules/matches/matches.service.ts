import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { MatchStatus, Role } from "@3x3/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthenticatedUser, ClubContext } from "../../common/types/authenticated-request";
import { CreateMatchDto, RecordMatchResultDto, UpdateMatchDto } from "@3x3/shared";

const MANAGE_ROLES: Role[] = [Role.CLUB_ADMIN, Role.COACH];

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

  async create(
    user: AuthenticatedUser,
    clubContext: ClubContext,
    tournamentId: string,
    dto: CreateMatchDto
  ) {
    const [homeTeam, awayTeam] = await Promise.all([
      this.prisma.team.findUnique({ where: { id: dto.homeTeamId }, select: { clubId: true } }),
      this.prisma.team.findUnique({ where: { id: dto.awayTeamId }, select: { clubId: true } }),
    ]);
    if (!homeTeam || !awayTeam) {
      throw new NotFoundException("Home or away team not found.");
    }
    // Either side of the matchup may schedule it — a club admin/coach from the home team's
    // club or the away team's club, not necessarily both.
    this.assertCanManage(user, clubContext, [homeTeam.clubId, awayTeam.clubId]);

    return this.prisma.match.create({
      data: {
        tournamentId,
        homeTeamId: dto.homeTeamId,
        awayTeamId: dto.awayTeamId,
        scheduledAt: dto.scheduledAt,
        createdById: user.id,
      },
    });
  }

  async update(user: AuthenticatedUser, clubContext: ClubContext, matchId: string, dto: UpdateMatchDto) {
    await this.ensureEditable(user, clubContext, matchId);
    return this.prisma.match.update({ where: { id: matchId }, data: dto });
  }

  async recordResult(
    user: AuthenticatedUser,
    clubContext: ClubContext,
    matchId: string,
    dto: RecordMatchResultDto
  ) {
    await this.ensureEditable(user, clubContext, matchId);
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

  async remove(user: AuthenticatedUser, clubContext: ClubContext, matchId: string) {
    const match = await this.ensureEditable(user, clubContext, matchId);
    // A played match's result can still be corrected via PATCH .../result, but not silently
    // deleted — superadmin can override for genuine cleanup (e.g. a duplicate/mistaken match).
    if (match.status === MatchStatus.PLAYED && !user.isSuperadmin) {
      throw new BadRequestException("Cannot delete a played match — correct the result instead.");
    }
    await this.prisma.match.delete({ where: { id: matchId } });
  }

  private async ensureEditable(user: AuthenticatedUser, clubContext: ClubContext, matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { homeTeam: { select: { clubId: true } }, awayTeam: { select: { clubId: true } } },
    });
    if (!match) {
      throw new NotFoundException("Match not found.");
    }
    this.assertCanManage(user, clubContext, [match.homeTeam.clubId, match.awayTeam.clubId]);
    return match;
  }

  private assertCanManage(user: AuthenticatedUser, clubContext: ClubContext, clubIds: string[]) {
    if (user.isSuperadmin) return;
    const canManage = clubIds.some((clubId) => MANAGE_ROLES.includes(clubContext.roleByClubId[clubId]));
    if (!canManage) {
      throw new ForbiddenException("You must be a club admin or coach of the home or away team's club.");
    }
  }
}
