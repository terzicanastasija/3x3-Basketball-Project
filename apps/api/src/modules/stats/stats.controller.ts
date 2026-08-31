import { Controller, Get, Param } from "@nestjs/common";
import { StatsService } from "./stats.service";

@Controller()
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  // Polled by the frontend after locking a match, so "lock -> dashboard populates" is a
  // demonstrable flow instead of something only provable by waiting an arbitrary amount of time.
  @Get("matches/:matchId/stat-recompute-status")
  async recomputeStatus(@Param("matchId") matchId: string) {
    const ready = await this.statsService.hasMatchSnapshot(matchId);
    return { ready };
  }
}
