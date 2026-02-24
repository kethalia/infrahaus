// No "server-only" — used by worker process (runs outside Next.js via tsx)

/**
 * Per-Container SSH Key Storage (Redis)
 *
 * Stores encrypted SSH private keys per container in Redis for SSH access.
 * Each container gets its own Ed25519 key pair:
 *   - Public key injected via Proxmox API during creation
 *   - Private key stored here for service discovery, logs, and management
 *
 * Key format: container:{nodeName}/{vmid}:ssh-key
 * No TTL — keys persist until explicitly deleted (on container delete).
 *
 * Usage:
 *   - createContainerAction stores the key before enqueuing the worker
 *   - Worker, service discovery, and log routes retrieve the key
 *   - deleteContainerAction cleans up the key
 */

import type Redis from "ioredis";
import { SSH_KEY_PREFIX } from "@/lib/constants/infrastructure";

// ============================================================================
// Redis Key
// ============================================================================

/** Build the Redis key for a container's encrypted SSH private key */
export function getSshKeyRedisKey(containerId: string): string {
  return `${SSH_KEY_PREFIX}${containerId}`;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Store an encrypted SSH private key for a container.
 * The private key should already be encrypted via lib/encryption.ts.
 *
 * No TTL — the key persists until the container is deleted.
 */
export async function storeSshPrivateKey(
  redis: Redis,
  containerId: string,
  encryptedPrivateKey: string,
): Promise<void> {
  await redis.set(getSshKeyRedisKey(containerId), encryptedPrivateKey);
}

/**
 * Retrieve the encrypted SSH private key for a container.
 * Returns null if no key exists (container predates SSH key feature).
 */
export async function getSshPrivateKey(
  redis: Redis,
  containerId: string,
): Promise<string | null> {
  return redis.get(getSshKeyRedisKey(containerId));
}

/**
 * Delete the SSH private key for a container.
 * Called during container deletion to clean up.
 */
export async function deleteSshPrivateKey(
  redis: Redis,
  containerId: string,
): Promise<void> {
  await redis.del(getSshKeyRedisKey(containerId));
}
