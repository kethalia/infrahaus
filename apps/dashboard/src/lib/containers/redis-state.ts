// No "server-only" — used by worker process (runs outside Next.js via tsx)

/**
 * Redis Creation State
 *
 * Tracks container creation lifecycle in Redis, replacing the DB Container
 * model for in-progress creation jobs. Each creation job is stored as a
 * JSON hash keyed by {nodeName}/{vmid}, with an accompanying SET for
 * efficient listing of active creations (no KEYS scan).
 *
 * The compound key {nodeName}/{vmid} is required because VMIDs are only
 * unique within a Proxmox cluster — standalone nodes can share VMIDs.
 * Node names are unique per user (@@unique([userId, name]) constraint).
 *
 * Usage:
 *   - Creation action calls `storeCreationJob()` when enqueuing
 *   - Worker calls `updateCreationLifecycle()` on completion/error
 *   - Dashboard calls `listActiveCreations()` to show in-progress jobs
 *   - Cleanup happens automatically via Redis TTLs
 *
 * Key format: container:job:{nodeName}/{vmid}
 * Tracking SET: container:active-creations ({nodeName}/{vmid} members)
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

/** Separator for compound container IDs. Using ~ avoids URL-encoding issues
 *  that arise with / in path segments (%2F is decoded by some proxies/frameworks). */
const CONTAINER_ID_SEP = "~";

/**
 * Build the compound container identifier from node name and VMID.
 * This is the canonical ID format used across Redis keys, URLs, and Pub/Sub channels.
 *
 * @param nodeName - Proxmox node name (unique per user)
 * @param vmid - Container VMID (unique per node)
 * @returns Compound ID, e.g. "pve-04~100"
 */
export function toContainerId(nodeName: string, vmid: number): string {
  return `${nodeName}${CONTAINER_ID_SEP}${vmid}`;
}

/**
 * Parse a compound container ID into node name and VMID.
 *
 * @param containerId - Compound ID, e.g. "pve-04~100"
 * @returns { nodeName, vmid } or null if invalid
 */
export function parseContainerId(
  containerId: string,
): { nodeName: string; vmid: number } | null {
  const sepIdx = containerId.lastIndexOf(CONTAINER_ID_SEP);
  if (sepIdx <= 0) return null;
  const nodeName = containerId.slice(0, sepIdx);
  const vmid = parseInt(containerId.slice(sepIdx + 1), 10);
  if (!nodeName || isNaN(vmid)) return null;
  return { nodeName, vmid };
}

/**
 * Build the Redis key for a creation job.
 *
 * @param nodeName - Proxmox node name
 * @param vmid - Container VMID
 * @returns Redis key string, e.g. "container:job:pve-04~100"
 */
export function getCreationKey(nodeName: string, vmid: number): string {
  return `${CREATION_JOB_KEY_PREFIX}${toContainerId(nodeName, vmid)}`;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Store a new creation job in Redis.
 *
 * Uses SET NX to prevent overwriting an existing creation job (race-condition
 * guard — two concurrent requests for the same VMID won't both succeed).
 * If the key was set, adds the member to the active creations tracking set.
 *
 * @param redis - ioredis client instance
 * @param job - Creation job data to store
 * @returns true if stored, false if a job already exists for this VMID
 */
export async function storeCreationJob(
  redis: Redis,
  job: CreationJob,
): Promise<boolean> {
  const key = getCreationKey(job.nodeName, job.vmid);
  const member = toContainerId(job.nodeName, job.vmid);

  // SET NX EX — only succeeds if key doesn't already exist
  const result = await redis.set(
    key,
    JSON.stringify(job),
    "EX",
    CREATION_TTL_ACTIVE_S,
    "NX",
  );

  if (result !== "OK") {
    return false; // Key already exists — concurrent creation or stale job
  }

  // Key was set — add to active creations tracking set
  await redis.sadd(ACTIVE_CREATIONS_SET, member);
  return true;
}

/**
 * Retrieve a creation job from Redis by node name and VMID.
 *
 * @param redis - ioredis client instance
 * @param nodeName - Proxmox node name
 * @param vmid - Container VMID to look up
 * @returns The creation job or null if not found / expired
 */
export async function getCreationJob(
  redis: Redis,
  nodeName: string,
  vmid: number,
): Promise<CreationJob | null> {
  const raw = await redis.get(getCreationKey(nodeName, vmid));
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
 * @param nodeName - Proxmox node name
 * @param vmid - Container VMID
 * @param lifecycle - New lifecycle state
 * @param errorMessage - Optional error message (only for "error" state)
 */
export async function updateCreationLifecycle(
  redis: Redis,
  nodeName: string,
  vmid: number,
  lifecycle: CreationLifecycle,
  errorMessage?: string,
): Promise<void> {
  const key = getCreationKey(nodeName, vmid);
  const raw = await redis.get(key);
  if (!raw) return; // Job already expired — no-op

  let job: CreationJob;
  try {
    job = JSON.parse(raw) as CreationJob;
  } catch {
    return; // Corrupted data — let it expire
  }

  // Update fields — always overwrite errorMessage to clear stale errors on
  // non-error transitions (e.g. if a job were ever retried).
  job.lifecycle = lifecycle;
  job.errorMessage = errorMessage;

  // Determine TTL based on new lifecycle
  const ttl =
    lifecycle === "creating" ? CREATION_TTL_ACTIVE_S : CREATION_TTL_COMPLETE_S;

  const pipeline = redis.pipeline();
  pipeline.set(key, JSON.stringify(job), "EX", ttl);

  // Remove from active set when no longer creating
  if (lifecycle === "ready" || lifecycle === "error") {
    pipeline.srem(ACTIVE_CREATIONS_SET, toContainerId(nodeName, vmid));
  }

  await pipeline.exec();
}

/**
 * Delete a creation job from Redis entirely.
 *
 * Removes both the job key and the VMID from the active creations set.
 *
 * @param redis - ioredis client instance
 * @param nodeName - Proxmox node name
 * @param vmid - Container VMID to delete
 */
export async function deleteCreationJob(
  redis: Redis,
  nodeName: string,
  vmid: number,
): Promise<void> {
  const member = toContainerId(nodeName, vmid);
  const pipeline = redis.pipeline();
  pipeline.del(getCreationKey(nodeName, vmid));
  pipeline.srem(ACTIVE_CREATIONS_SET, member);
  await pipeline.exec();
}

/**
 * List all actively-creating container jobs.
 *
 * Uses the ACTIVE_CREATIONS_SET to avoid O(N) KEYS scan:
 *   1. SMEMBERS to get {nodeName}/{vmid} strings
 *   2. Pipeline GET for each member's creation key
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

  // Pipeline GET for all member keys (members are {nodeName}/{vmid} strings)
  const getPipeline = redis.pipeline();
  for (const member of members) {
    getPipeline.get(`${CREATION_JOB_KEY_PREFIX}${member}`);
  }
  const results = await getPipeline.exec();

  const activeJobs: CreationJob[] = [];
  const staleMembers: string[] = [];

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    // Pipeline results: [error, value] tuples
    const result = results?.[i];
    const raw = result?.[1] as string | null;

    if (!raw) {
      // Key expired — stale set member
      staleMembers.push(member);
      continue;
    }

    try {
      const job = JSON.parse(raw) as CreationJob;
      if (job.lifecycle === "creating") {
        activeJobs.push(job);
      } else {
        // Non-creating lifecycle still in active set — stale
        staleMembers.push(member);
      }
    } catch {
      // Corrupted data — clean up
      staleMembers.push(member);
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
