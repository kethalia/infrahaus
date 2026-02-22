import "server-only";

/**
 * Container helpers — server-only utilities for container management.
 *
 * Provides reusable patterns for getting authenticated ProxmoxClient
 * from the current session. Used by server actions and data-fetching functions.
 *
 * IMPORTANT: These helpers use the session ticket for Proxmox auth.
 * The session ticket is obtained at login and is valid for ~2 hours.
 * This is the correct auth method for interactive user requests (RSC, actions).
 * The worker process uses API token auth via createProxmoxClientFromNode() instead.
 */

import type { ProxmoxNode } from "@/generated/prisma/client";
import { ProxmoxClient } from "@/lib/proxmox/client";
import { getProxmoxCredentials } from "@/lib/session";
import { DatabaseService } from "@/lib/db";
import { ActionError } from "@/lib/safe-action";

/**
 * Create an authenticated ProxmoxClient using the session ticket
 * with host/port from a specific DB node record.
 *
 * Use this for all interactive Proxmox calls (RSC, server actions).
 * The session ticket has the same permissions as the logged-in user.
 *
 * @param node - ProxmoxNode from database (provides host/port)
 * @returns ProxmoxClient authenticated with session ticket
 * @throws ActionError if session is invalid
 */
export async function createSessionClient(
  node: Pick<ProxmoxNode, "host" | "port">,
): Promise<ProxmoxClient> {
  const credentials = await getProxmoxCredentials();
  if (!credentials) {
    throw new ActionError("Not authenticated");
  }

  return new ProxmoxClient({
    host: node.host,
    port: node.port,
    credentials,
    verifySsl: false,
  });
}

/**
 * Create an authenticated ProxmoxClient from the current user session.
 * Looks up the user's default ProxmoxNode from DB for host/port config.
 * Throws if session is invalid or no node is configured.
 */
export async function createProxmoxClientFromSession(): Promise<{
  client: ProxmoxClient;
  node: { id: string; name: string; host: string; port: number };
}> {
  const credentials = await getProxmoxCredentials();
  if (!credentials) {
    throw new ActionError("Not authenticated");
  }

  // Use session username as userId for node scoping
  const userId = credentials.username || "root@pam";

  // Get the user's default node, or first node if no default set
  let pveNode = await DatabaseService.getDefaultNodeForUser(userId);
  if (!pveNode) {
    const nodes = await DatabaseService.listNodesForUser(userId);
    pveNode = nodes[0] ?? null;
  }
  if (!pveNode) {
    throw new ActionError(
      "No Proxmox node configured. Add one in Settings → Nodes.",
    );
  }

  const client = new ProxmoxClient({
    host: pveNode.host,
    port: pveNode.port,
    credentials,
    verifySsl: false,
  });

  return {
    client,
    node: {
      id: pveNode.id,
      name: pveNode.name,
      host: pveNode.host,
      port: pveNode.port,
    },
  };
}
