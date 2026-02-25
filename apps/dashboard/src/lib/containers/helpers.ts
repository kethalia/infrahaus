import "server-only";

/**
 * Container helpers — server-only utilities for container management.
 *
 * Provides reusable patterns for getting authenticated ProxmoxClient
 * from node-stored API token credentials. Session check ensures the
 * user is authenticated (Universal Profile connected).
 *
 * The worker process uses createProxmoxClientFromNode() directly (no session).
 */

import type { ProxmoxNode } from "@/generated/prisma/client";
import type { ProxmoxClient } from "@/lib/proxmox/client";
import { getSessionData } from "@/lib/session";
import { createProxmoxClientFromNode } from "@/lib/proxmox/index";
import { ActionError } from "@/lib/safe-action";

/**
 * Create an authenticated ProxmoxClient using the node's stored API token
 * credentials. Verifies the user is authenticated via session check.
 *
 * Use this for all interactive Proxmox calls (RSC, server actions).
 * Node credentials (API token) provide Proxmox API access.
 * Session check ensures the user is authenticated (wallet connected).
 *
 * @param node - ProxmoxNode from database (must have tokenId + tokenSecret)
 * @returns ProxmoxClient authenticated with node's API token
 * @throws ActionError if session is invalid or node has no API token
 */
export async function createSessionClient(
  node: Pick<ProxmoxNode, "host" | "port" | "tokenId" | "tokenSecret" | "name">,
): Promise<ProxmoxClient> {
  const sessionData = await getSessionData();
  if (!sessionData) {
    throw new ActionError("Not authenticated. Connect your Universal Profile.");
  }

  return createProxmoxClientFromNode(node as ProxmoxNode);
}
