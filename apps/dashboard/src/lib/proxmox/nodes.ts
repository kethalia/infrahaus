/**
 * Proxmox VE node operations
 */

import "server-only";
import type { ProxmoxClient } from "./client.js";
import type { ProxmoxNode, ProxmoxNodeStatus } from "./types.js";

/**
 * List all nodes in the cluster
 */
export async function listNodes(client: ProxmoxClient): Promise<ProxmoxNode[]> {
  return client.get<ProxmoxNode[]>("/nodes");
}

/**
 * Get status of a specific node
 */
export async function getNodeStatus(
  client: ProxmoxClient,
  node: string,
): Promise<ProxmoxNodeStatus> {
  return client.get<ProxmoxNodeStatus>(`/nodes/${node}/status`);
}
