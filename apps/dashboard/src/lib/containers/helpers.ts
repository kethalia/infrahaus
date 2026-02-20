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
import { ActionError } from "@/lib/safe-action";

/**
 * Create an authenticated ProxmoxClient from the current user session.
 * Looks up the user's default ProxmoxNode from DB for host/port config.
 * Throws if session is invalid or no node is configured.
 *
 * TODO(03.5-04): Refactor to use createProxmoxClientFromNode() with DB-stored tokens
 * instead of session-based ticket credentials. The session will only provide userId.
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
  // TODO(03.5-04): Get userId from session properly
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
