import { Injectable } from "@nestjs/common";
import { StatScope } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

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
  // findFirst, not findUnique — Prisma's compound-unique where() rejects null at runtime even
  // though the columns/index are nullable (see stats.service.ts's upsertSnapshot for the same
  // issue), and playerId/matchId are null here.
  teamDashboard(teamId: string, tournamentId: string) {
    return this.prisma.statSnapshot.findFirst({
      where: { scopeType: StatScope.TOURNAMENT, playerId: null, teamId, matchId: null, tournamentId },
    });
  }

  async playerDashboard(playerId: string) {
    const [career, matches] = await Promise.all([
      this.prisma.statSnapshot.findFirst({
        where: { scopeType: StatScope.CAREER, playerId, teamId: null, matchId: null, tournamentId: null },
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
