import { ConfigService } from "@nestjs/config";
import IORedis from "ioredis";
import { Env } from "../../config/env.validation";

export const REDIS_CONNECTION = "REDIS_CONNECTION";

// BullMQ requires maxRetriesPerRequest: null on connections it owns.
export function createRedisConnection(configService: ConfigService<Env, true>): IORedis {
  return new IORedis(configService.get("REDIS_URL", { infer: true }), {
    maxRetriesPerRequest: null,
  });
}
