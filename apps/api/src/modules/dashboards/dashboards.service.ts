import { Injectable } from "@nestjs/common";
import { StatScope } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { statSnapshotUniqueWhere } from "../../common/prisma/stat-snapshot-key";

@Injectable()
export class DashboardsService {
  constructor(private readonly prisma: PrismaService) {}

  // Box score: every MATCH-scope row (players + teams) for this match. Reads only from
  // StatSnapshot — never live-aggregates ActionTag — so this stays fast as tag history grows.
  matchDashboard(matchId: string) {
    return this.prisma.statSnapshot.findMany({
      where: { scopeType: StatScope.MATCH, matchId },
      include: {
        player: { select: { id: true, firstName: true, lastName: true } },
        team: { select: { id: true, name: true } },
      },
      orderBy: { points: "desc" },
    });
  }

  // Teams have no CAREER scope (see stats.service.ts) — a team dashboard is always scoped to
  // one tournament. Returns null if the team hasn't had a locked match in that tournament yet.
  teamDashboard(teamId: string, tournamentId: string) {
    return this.prisma.statSnapshot.findUnique({
      where: {
        scopeType_playerId_teamId_matchId_tournamentId: statSnapshotUniqueWhere({
          scopeType: StatScope.TOURNAMENT,
          playerId: null,
          teamId,
          matchId: null,
          tournamentId,
        }),
      },
    });
  }

  async playerDashboard(playerId: string) {
    const [career, matches] = await Promise.all([
      this.prisma.statSnapshot.findUnique({
        where: {
          scopeType_playerId_teamId_matchId_tournamentId: statSnapshotUniqueWhere({
            scopeType: StatScope.CAREER,
            playerId,
            teamId: null,
            matchId: null,
            tournamentId: null,
          }),
        },
      }),
      this.prisma.statSnapshot.findMany({
        where: { scopeType: StatScope.MATCH, playerId },
        include: {
          match: {
            select: { id: true, tournamentId: true, homeTeamId: true, awayTeamId: true, scheduledAt: true },
          },
        },
        orderBy: { computedAt: "desc" },
      }),
    ]);
    return { career, matches };
  }
}
