import { Module } from "@nestjs/common";
import { StatsController } from "./stats.controller";
import { StatsService } from "./stats.service";
import { StatRecomputeWorker } from "./stat-recompute.worker";

@Module({
  controllers: [StatsController],
  providers: [StatsService, StatRecomputeWorker],
  exports: [StatsService],
})
export class StatsModule {}
