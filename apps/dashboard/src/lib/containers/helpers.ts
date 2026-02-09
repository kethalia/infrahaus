import "server-only";

/**
 * Container helpers — server-only utilities for container management.
 *
 * Provides reusable patterns for getting authenticated ProxmoxClient
 * from the current session. Used by server actions and data-fetching functions.
 */

import { ProxmoxClient } from "@/lib/proxmox/client";
import { getProxmoxCredentials } from "@/lib/session";
import { DatabaseService } from "@/lib/db";

/**
 * Create an authenticated ProxmoxClient from the current user session.
 * Looks up the first ProxmoxNode in DB for host/port config.
 * Throws if session is invalid or no node is configured.
 */
export async function createProxmoxClientFromSession(): Promise<{
  client: ProxmoxClient;
  node: { id: string; name: string; host: string; port: number };
}> {
  const credentials = await getProxmoxCredentials();
  if (!credentials) {
    throw new Error("Not authenticated");
  }

  // Get the first configured node (single-node setup)
  const nodes = await DatabaseService.listNodes();
  const pveNode = nodes[0];
  if (!pveNode) {
    throw new Error("No Proxmox node configured");
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
