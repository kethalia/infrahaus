// No "server-only" — used by worker process (runs outside Next.js via tsx)

/**
 * Per-Container Credential Storage (PostgreSQL)
 *
 * Stores SSH keys and root passwords per container in PostgreSQL for durability.
 * Each container gets its own Ed25519 key pair:
 *   - Public key injected via Proxmox API during creation
 *   - Private key stored here for direct SSH to container
 *   - Root password stored for reference (generated during creation)
 *
 * Keyed by compound containerId ({nodeName}/{vmid}) — same format used
 * across Redis keys, URLs, and internal identifiers.
 *
 * Usage:
 *   - createContainerAction stores credentials before enqueuing the worker
 *   - Worker, service discovery, and log routes retrieve the SSH key
 *   - deleteContainerAction cleans up credentials
 */

import { prisma } from "@/lib/db";

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Store container credentials (SSH key pair + root password).
 * Called by createContainerAction before enqueuing the BullMQ job.
 *
 * All secrets should be pre-encrypted via lib/encryption.ts.
 */
export async function storeContainerCredential(data: {
  containerId: string;
  userId: string;
  sshPrivateKey: string; // Encrypted
  sshPublicKey: string; // Plain text
  rootPassword: string; // Encrypted
}): Promise<void> {
  await prisma.containerCredential.upsert({
    where: { containerId: data.containerId },
    create: data,
    update: {
      sshPrivateKey: data.sshPrivateKey,
      sshPublicKey: data.sshPublicKey,
      rootPassword: data.rootPassword,
    },
  });
}

/**
 * Retrieve the encrypted SSH private key for a container.
 * Returns null if no credentials exist (container predates SSH key feature).
 */
export async function getContainerSshKey(
  containerId: string,
): Promise<string | null> {
  const cred = await prisma.containerCredential.findUnique({
    where: { containerId },
    select: { sshPrivateKey: true },
  });
  return cred?.sshPrivateKey ?? null;
}

/**
 * Retrieve all credentials for a container (for display/management).
 * Returns null if no credentials exist.
 */
export async function getContainerCredential(containerId: string) {
  return prisma.containerCredential.findUnique({
    where: { containerId },
  });
}

/**
 * Delete credentials for a container.
 * Called during container deletion to clean up.
 * Silently succeeds if no credentials exist.
 */
export async function deleteContainerCredential(
  containerId: string,
): Promise<void> {
  await prisma.containerCredential
    .delete({ where: { containerId } })
    .catch(() => {
      // Silently ignore if credential doesn't exist
    });
}

/**
 * List all container credentials for a user.
 * Used for settings/management views.
 */
export async function listContainerCredentials(userId: string) {
  return prisma.containerCredential.findMany({
    where: { userId },
    select: {
      containerId: true,
      sshPublicKey: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get the set of containerIds that have stored credentials for a user.
 * Used for efficient batch "is managed?" checks on the dashboard.
 * Returns a Set<string> of compound containerIds (e.g. "pve-04/100").
 */
export async function getManagedContainerIds(
  userId: string,
): Promise<Set<string>> {
  const rows = await prisma.containerCredential.findMany({
    where: { userId },
    select: { containerId: true },
  });
  return new Set(rows.map((r) => r.containerId));
}
