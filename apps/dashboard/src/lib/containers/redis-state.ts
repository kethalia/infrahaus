// No "server-only" — used by worker process (runs outside Next.js via tsx)

/**
 * Redis Creation State
 *
 * Tracks container creation lifecycle in Redis, replacing the DB Container
 * model for in-progress creation jobs. Each creation job is stored as a
 * JSON hash keyed by VMID, with an accompanying SET for efficient listing
 * of active creations (no KEYS scan).
 *
 * Usage:
 *   - Creation action calls `storeCreationJob()` when enqueuing
 *   - Worker calls `updateCreationLifecycle()` on completion/error
 *   - Dashboard calls `listActiveCreations()` to show in-progress jobs
 *   - Cleanup happens automatically via Redis TTLs
 *
 * Key format: container:job:{vmid}
 * Tracking SET: container:active-creations (VMID members)
 * TTLs: 24h active, 1h completed/errored
 */

import type Redis from "ioredis";
import {
  CREATION_JOB_KEY_PREFIX,
  ACTIVE_CREATIONS_SET,
  CREATION_TTL_ACTIVE_S,
  CREATION_TTL_COMPLETE_S,
} from "@/lib/constants/infrastructure";

// ============================================================================
// Types
// ============================================================================

/** Container creation lifecycle — replaces Prisma ContainerLifecycle enum */
export type CreationLifecycle = "creating" | "ready" | "error";

/** Creation job stored in Redis — replaces DB Container model for in-progress jobs */
export interface CreationJob {
  vmid: number;
  nodeId: string;
  nodeName: string;
  templateId: string | null;
  hostname: string;
  lifecycle: CreationLifecycle;
  createdAt: string; // ISO 8601
  errorMessage?: string;
}

// ============================================================================
// Key Helpers
// ============================================================================

/**
 * Build the Redis key for a creation job by VMID.
 *
 * @param vmid - Container VMID
 * @returns Redis key string, e.g. "container:job:100"
 */
export function getCreationKey(vmid: number): string {
  return `${CREATION_JOB_KEY_PREFIX}${vmid}`;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Store a new creation job in Redis.
 *
 * Uses a pipeline for atomicity:
 *   1. SET the job JSON with 24h TTL
 *   2. SADD the VMID to the active creations tracking set
 *
 * @param redis - ioredis client instance
 * @param job - Creation job data to store
 */
export async function storeCreationJob(
  redis: Redis,
  job: CreationJob,
): Promise<void> {
  const key = getCreationKey(job.vmid);
  const pipeline = redis.pipeline();
  pipeline.set(key, JSON.stringify(job), "EX", CREATION_TTL_ACTIVE_S);
  pipeline.sadd(ACTIVE_CREATIONS_SET, String(job.vmid));
  await pipeline.exec();
}

/**
 * Retrieve a creation job from Redis by VMID.
 *
 * @param redis - ioredis client instance
 * @param vmid - Container VMID to look up
 * @returns The creation job or null if not found / expired
 */
export async function getCreationJob(
  redis: Redis,
  vmid: number,
): Promise<CreationJob | null> {
  const raw = await redis.get(getCreationKey(vmid));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as CreationJob;
  } catch {
    return null;
  }
}

/**
 * Update the lifecycle state of a creation job.
 *
 * - For "ready" or "error": sets 1h TTL and removes from active set
 * - For "creating": keeps 24h TTL and stays in active set
 * - Returns early if the job has already expired (no-op)
 *
 * @param redis - ioredis client instance
 * @param vmid - Container VMID
 * @param lifecycle - New lifecycle state
 * @param errorMessage - Optional error message (only for "error" state)
 */
export async function updateCreationLifecycle(
  redis: Redis,
  vmid: number,
  lifecycle: CreationLifecycle,
  errorMessage?: string,
): Promise<void> {
  const key = getCreationKey(vmid);
  const raw = await redis.get(key);
  if (!raw) return; // Job already expired — no-op

  let job: CreationJob;
  try {
    job = JSON.parse(raw) as CreationJob;
  } catch {
    return; // Corrupted data — let it expire
  }

  // Update fields
  job.lifecycle = lifecycle;
  if (errorMessage !== undefined) {
    job.errorMessage = errorMessage;
  }

  // Determine TTL based on new lifecycle
  const ttl =
    lifecycle === "creating" ? CREATION_TTL_ACTIVE_S : CREATION_TTL_COMPLETE_S;

  const pipeline = redis.pipeline();
  pipeline.set(key, JSON.stringify(job), "EX", ttl);

  // Remove from active set when no longer creating
  if (lifecycle === "ready" || lifecycle === "error") {
    pipeline.srem(ACTIVE_CREATIONS_SET, String(vmid));
  }

  await pipeline.exec();
}

/**
 * Delete a creation job from Redis entirely.
 *
 * Removes both the job key and the VMID from the active creations set.
 *
 * @param redis - ioredis client instance
 * @param vmid - Container VMID to delete
 */
export async function deleteCreationJob(
  redis: Redis,
  vmid: number,
): Promise<void> {
  const pipeline = redis.pipeline();
  pipeline.del(getCreationKey(vmid));
  pipeline.srem(ACTIVE_CREATIONS_SET, String(vmid));
  await pipeline.exec();
}

/**
 * List all actively-creating container jobs.
 *
 * Uses the ACTIVE_CREATIONS_SET to avoid O(N) KEYS scan:
 *   1. SMEMBERS to get VMID strings
 *   2. Pipeline GET for each VMID's creation key
 *   3. Filter: keep only jobs that parsed and have lifecycle "creating"
 *   4. Cleanup: SREM stale members (expired keys or non-creating lifecycle)
 *
 * @param redis - ioredis client instance
 * @returns Array of actively-creating jobs
 */
export async function listActiveCreations(
  redis: Redis,
): Promise<CreationJob[]> {
  const members = await redis.smembers(ACTIVE_CREATIONS_SET);
  if (members.length === 0) return [];

  // Pipeline GET for all member keys
  const getPipeline = redis.pipeline();
  for (const vmidStr of members) {
    getPipeline.get(`${CREATION_JOB_KEY_PREFIX}${vmidStr}`);
  }
  const results = await getPipeline.exec();

  const activeJobs: CreationJob[] = [];
  const staleMembers: string[] = [];

  for (let i = 0; i < members.length; i++) {
    const vmidStr = members[i];
    // Pipeline results: [error, value] tuples
    const result = results?.[i];
    const raw = result?.[1] as string | null;

    if (!raw) {
      // Key expired — stale set member
      staleMembers.push(vmidStr);
      continue;
    }

    try {
      const job = JSON.parse(raw) as CreationJob;
      if (job.lifecycle === "creating") {
        activeJobs.push(job);
      } else {
        // Non-creating lifecycle still in active set — stale
        staleMembers.push(vmidStr);
      }
    } catch {
      // Corrupted data — clean up
      staleMembers.push(vmidStr);
    }
  }

  // Clean up stale set members in background (fire and forget)
  if (staleMembers.length > 0) {
    redis.srem(ACTIVE_CREATIONS_SET, ...staleMembers).catch(() => {
      // Non-fatal: stale members will be cleaned up next time
    });
  }

  return activeJobs;
}
