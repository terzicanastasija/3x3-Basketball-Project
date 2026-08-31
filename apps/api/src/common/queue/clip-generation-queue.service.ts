import { Inject, Injectable, OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { REDIS_CONNECTION } from "./redis-connection";

export const CLIP_GENERATION_QUEUE_NAME = "clip-generation";

export interface ClipGenerationJobData {
  actionTagId: string;
}

// Producer side only — TagsService enqueues here when a FILE-source tag is created. The
// consumer (Worker) lives in ClipsModule; both sides just need to agree on the queue name +
// Redis connection, not on each other's module internals, to avoid a TagsModule <-> ClipsModule
// circular dependency (same pattern as StatRecomputeQueueService/StatsModule).
@Injectable()
export class ClipGenerationQueueService implements OnModuleDestroy {
  private readonly queue: Queue<ClipGenerationJobData>;

  constructor(@Inject(REDIS_CONNECTION) connection: IORedis) {
    this.queue = new Queue<ClipGenerationJobData>(CLIP_GENERATION_QUEUE_NAME, { connection });
  }

  enqueueClipGeneration(actionTagId: string) {
    return this.queue.add("generate-clip", { actionTagId });
  }

  async onModuleDestroy() {
    await this.queue.close();
  }
}
