// No "server-only" — used by worker process for cache invalidation on container create

/**
 * Redis VMID Cache
 *
 * Caches the set of taken VMIDs per Proxmox node in Redis using SET data
 * structure. Enables O(1) availability checks in the creation wizard and
 * event-driven invalidation on container create/delete.
 *
 * Key format: vmid-cache:{nodeId}
 * Value type: Redis SET of VMID strings
 * TTL: 5 minutes (stale data caught at Proxmox create time)
 */

import { getRedis } from "@/lib/redis";
import { listContainers } from "@/lib/proxmox/containers";
import type { ProxmoxClient } from "@/lib/proxmox/client";
import {
  VMID_CACHE_PREFIX,
  VMID_CACHE_TTL_S,
} from "@/lib/constants/infrastructure";

/**
 * Build the Redis key for a node's VMID cache.
 */
function cacheKey(nodeId: string): string {
  return `${VMID_CACHE_PREFIX}${nodeId}`;
}

/**
 * Refresh the VMID cache for a node by querying Proxmox for all LXC containers.
 *
 * Fetches the current container list from Proxmox, extracts VMIDs, and stores
 * them as a Redis SET with a 5-minute TTL. Uses a pipeline for atomicity.
 *
 * @param nodeId - Database ID of the ProxmoxNode record
 * @param nodeName - Proxmox node name (e.g., "pve") for the API path
 * @param client - Authenticated ProxmoxClient instance
 * @returns Array of taken VMID numbers
 */
export async function refreshVmidCache(
  nodeId: string,
  nodeName: string,
  client: ProxmoxClient,
): Promise<number[]> {
  const containers = await listContainers(client, nodeName);
  const vmids = containers.map((c) => c.vmid);

  const redis = getRedis();
  const key = cacheKey(nodeId);

  const pipeline = redis.pipeline();
  pipeline.del(key);
  if (vmids.length > 0) {
    pipeline.sadd(key, ...vmids.map(String));
  }
  pipeline.expire(key, VMID_CACHE_TTL_S);
  await pipeline.exec();

  return vmids;
}

/**
 * Check if a VMID is taken on a specific node (from cache).
 *
 * Returns true if the VMID exists in the cached set. If the cache key has
 * expired (doesn't exist), returns false — the caller handles final
 * validation at container create time via the Proxmox API.
 *
 * @param nodeId - Database ID of the ProxmoxNode record
 * @param vmid - VMID to check availability for
 * @returns true if taken, false if available (or cache expired)
 */
export async function isVmidTaken(
  nodeId: string,
  vmid: number,
): Promise<boolean> {
  const redis = getRedis();
  return (await redis.sismember(cacheKey(nodeId), String(vmid))) === 1;
}

/**
 * Invalidate the VMID cache for a node.
 *
 * Called after container create or delete to force a cache refresh
 * on the next wizard open.
 *
 * @param nodeId - Database ID of the ProxmoxNode record
 */
export async function invalidateVmidCache(nodeId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(cacheKey(nodeId));
}

/**
 * Get all cached VMIDs for a node.
 *
 * Returns the full set of taken VMIDs from cache. Used by the wizard
 * to show inline validation (red/green indicators) as the user types.
 * Returns an empty array if the cache has expired.
 *
 * @param nodeId - Database ID of the ProxmoxNode record
 * @returns Array of taken VMID numbers (empty if cache expired)
 */
export async function getCachedVmids(nodeId: string): Promise<number[]> {
  const redis = getRedis();
  const members = await redis.smembers(cacheKey(nodeId));
  return members.map(Number);
}
