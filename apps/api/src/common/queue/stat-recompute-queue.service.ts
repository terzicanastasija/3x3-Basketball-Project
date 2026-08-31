import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { REDIS_CONNECTION } from "./redis-connection";

export const STAT_RECOMPUTE_QUEUE_NAME = "stat-recompute";

export interface StatRecomputeJobData {
  matchId: string;
}

// Producer side only — TagsService enqueues here on match lock. The consumer (Worker) lives
// in StatsModule; both sides just need to agree on the queue name + Redis connection, not on
// each other's module internals, to avoid a TagsModule <-> StatsModule circular dependency.
@Injectable()
export class StatRecomputeQueueService implements OnModuleDestroy {
  private readonly queue: Queue<StatRecomputeJobData>;

  constructor(@Inject(REDIS_CONNECTION) connection: IORedis) {
    this.queue = new Queue<StatRecomputeJobData>(STAT_RECOMPUTE_QUEUE_NAME, { connection });
  }

  enqueueMatchRecompute(matchId: string) {
    return this.queue.add("recompute", { matchId });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
