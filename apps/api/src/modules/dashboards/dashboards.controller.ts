import { Controller, Get, Param, Query } from "@nestjs/common";
import { ZodValidationPipe } from "nestjs-zod";
import { teamDashboardQuerySchema, TeamDashboardQueryDto } from "@3x3/shared";
import { DashboardsService } from "./dashboards.service";

@Controller()
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  // Open reads — same cross-club-discovery spirit as tournaments/matches/players.
  @Get("matches/:matchId/dashboard")
  matchDashboard(@Param("matchId") matchId: string) {
    return this.dashboardsService.matchDashboard(matchId);
  }

  @Get("teams/:teamId/dashboard")
  teamDashboard(
    @Param("teamId") teamId: string,
    @Query(new ZodValidationPipe(teamDashboardQuerySchema)) query: TeamDashboardQueryDto
  ) {
    return this.dashboardsService.teamDashboard(teamId, query.tournamentId);
  }

  @Get("players/:playerId/dashboard")
  playerDashboard(@Param("playerId") playerId: string) {
    return this.dashboardsService.playerDashboard(playerId);
  }
}
