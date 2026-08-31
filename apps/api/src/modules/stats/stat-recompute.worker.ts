import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { REDIS_CONNECTION } from "../../common/queue/redis-connection";
import { STAT_RECOMPUTE_QUEUE_NAME, StatRecomputeJobData } from "../../common/queue/stat-recompute-queue.service";
import { StatsService } from "./stats.service";

// Runs in-process within the Nest app — a single worker process is enough at this scale
// (per the plan), so this deliberately isn't a separate deployable entry point.
@Injectable()
export class StatRecomputeWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StatRecomputeWorker.name);
  private worker?: Worker<StatRecomputeJobData>;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly connection: IORedis,
    private readonly statsService: StatsService
  ) {}

  onModuleInit() {
    this.worker = new Worker<StatRecomputeJobData>(
      STAT_RECOMPUTE_QUEUE_NAME,
      async (job) => {
        await this.statsService.recomputeForMatch(job.data.matchId);
      },
      { connection: this.connection }
    );
    this.worker.on("failed", (job, err) => {
      this.logger.error(`stat-recompute job ${job?.id} failed for match ${job?.data.matchId}: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
