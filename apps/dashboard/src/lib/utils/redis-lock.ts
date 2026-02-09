// No "server-only" — may be used by worker process

/**
 * Distributed Redis lock utilities.
 *
 * Implements a safe ownership-based lock pattern using SET NX + Lua
 * compare-and-delete. Each lock is identified by a key prefix + resource ID,
 * and protected by a unique ownership token to prevent accidental release.
 */

import { getRedis } from "@/lib/redis";

/**
 * Lua script for compare-and-delete: only deletes the key if its value
 * matches the ownership token. Prevents one caller from releasing another
 * caller's lock after TTL-based expiry and re-acquisition.
 */
const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

/**
 * Acquire a Redis lock for a resource.
 *
 * @param key - Full Redis key for the lock (e.g., "container-lock:abc-123")
 * @param ttlSeconds - Lock TTL in seconds (prevents stuck locks)
 * @returns Ownership token if lock acquired, null if already locked
 */
export async function acquireLock(
  key: string,
  ttlSeconds: number,
): Promise<string | null> {
  const redis = getRedis();
  const token = crypto.randomUUID();
  const result = await redis.set(key, token, "EX", ttlSeconds, "NX");
  return result === "OK" ? token : null;
}

/**
 * Release a Redis lock using compare-and-delete.
 * Only releases the lock if the ownership token matches, preventing
 * accidental release of another caller's lock.
 *
 * @param key - Full Redis key for the lock
 * @param token - Ownership token returned from acquireLock()
 */
export async function releaseLock(key: string, token: string): Promise<void> {
  const redis = getRedis();
  await redis.eval(RELEASE_LOCK_SCRIPT, 1, key, token);
}
