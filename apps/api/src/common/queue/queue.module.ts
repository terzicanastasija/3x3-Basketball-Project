import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Env } from "../../config/env.validation";
import { createRedisConnection, REDIS_CONNECTION } from "./redis-connection";
import { StatRecomputeQueueService } from "./stat-recompute-queue.service";
import { ClipGenerationQueueService } from "./clip-generation-queue.service";

// Global so any module can inject StatRecomputeQueueService/ClipGenerationQueueService (or the
// raw connection) without re-importing QueueModule everywhere — only needs to be imported once,
// in AppModule.
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CONNECTION,
      useFactory: (configService: ConfigService<Env, true>) => createRedisConnection(configService),
      inject: [ConfigService],
    },
    StatRecomputeQueueService,
    ClipGenerationQueueService,
  ],
  exports: [REDIS_CONNECTION, StatRecomputeQueueService, ClipGenerationQueueService],
})
export class QueueModule {}
