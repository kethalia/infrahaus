// No "server-only" — used by worker process (runs outside Next.js via tsx)

import Redis from "ioredis";
import { REDIS_RETRY_DELAY_MULTIPLIER_MS } from "@/lib/constants/timeouts";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error(
        "REDIS_URL environment variable is not set. Please configure it in your .env file.",
      );
    }

    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * REDIS_RETRY_DELAY_MULTIPLIER_MS, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    redis.on("error", (error) => {
      console.error("Redis connection error:", error);
    });

    redis.on("connect", () => {
      console.log("Redis connected successfully");
    });
  }

  return redis;
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
