// No "server-only" — used by worker process (runs outside Next.js via tsx)

/**
 * Proxmox VE API Client
 * Main entry point - exports all modules and factory functions
 *
 * After 03.5-04 refactor: All client creation is DB-based via
 * createProxmoxClientFromNode(). The env-var-based getProxmoxClient()
 * and deprecated createProxmoxClientFromTicket() have been removed.
 */

// Server-side module — do not import from client components
// Type-only import from generated Prisma client - does not violate db.ts import rule
// as this is erased at runtime and only used for type checking
import type { ProxmoxNode } from "@/generated/prisma/client";
import { decrypt } from "../encryption";
import { ProxmoxClient } from "./client";
import { DatabaseService } from "@/lib/db";
import type { ProxmoxApiTokenCredentials, ProxmoxClientConfig } from "./types";

// ============================================================================
// Re-export all types and schemas
// ============================================================================

export * from "./types";
export * from "./schemas";
export * from "./errors";

// ============================================================================
// Re-export all modules
// ============================================================================

export { ProxmoxClient } from "./client";
export * as auth from "./auth";
export * as nodes from "./nodes";
export * as containers from "./containers";
export * as tasks from "./tasks";
export * as storage from "./storage";
export * as templates from "./templates";

// ============================================================================
// Factory functions
// ============================================================================

/**
 * Create a Proxmox client from configuration
 */
export function createProxmoxClient(
  config: ProxmoxClientConfig,
): ProxmoxClient {
  return new ProxmoxClient(config);
}

/**
 * Create a Proxmox client from a Prisma ProxmoxNode model using API token auth.
 * Automatically decrypts the stored tokenSecret.
 *
 * Used by the worker process (no user session available).
 * Throws if tokenId/tokenSecret are not configured on the node.
 *
 * @param node - ProxmoxNode from database
 * @param verifySsl - Whether to verify SSL certificates (default: false for self-signed certs)
 */
export function createProxmoxClientFromNode(
  node: ProxmoxNode,
  verifySsl = false,
): ProxmoxClient {
  if (!node.tokenId || !node.tokenSecret) {
    throw new Error(
      `Node "${node.name}" does not have API token credentials configured. ` +
        "API tokens are required for background operations (container creation). " +
        "Add them in Settings → Nodes.",
    );
  }

  // Decrypt the token secret
  const tokenSecret = decrypt(node.tokenSecret);

  // Create API token credentials
  const credentials: ProxmoxApiTokenCredentials = {
    type: "token",
    tokenId: node.tokenId,
    tokenSecret,
  };

  // Create client config
  const config: ProxmoxClientConfig = {
    host: node.host,
    port: node.port,
    credentials,
    verifySsl,
  };

  return new ProxmoxClient(config);
}

/**
 * Convenience: Get a Proxmox client by looking up a node ID from the database.
 *
 * @param nodeId - Database ID of the ProxmoxNode record
 * @returns Authenticated ProxmoxClient
 * @throws Error if node not found
 */
export async function getProxmoxClientForNode(
  nodeId: string,
): Promise<ProxmoxClient> {
  const node = await DatabaseService.getNodeById(nodeId);
  if (!node) throw new Error(`Proxmox node not found: ${nodeId}`);
  return createProxmoxClientFromNode(node);
}
