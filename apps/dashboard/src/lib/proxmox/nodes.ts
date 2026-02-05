/**
 * Proxmox VE node operations
 */

import "server-only";
import { z } from "zod";
import type { ProxmoxClient } from "./client.js";
import { NodeSchema, NodeStatusSchema } from "./schemas.js";
import type { ProxmoxNode, ProxmoxNodeStatus } from "./types.js";

/**
 * List all nodes in the cluster
 */
export async function listNodes(client: ProxmoxClient): Promise<ProxmoxNode[]> {
  return client.get("/nodes", z.array(NodeSchema));
}

/**
 * Get status of a specific node
 */
export async function getNodeStatus(
  client: ProxmoxClient,
  node: string,
): Promise<ProxmoxNodeStatus> {
  return client.get(`/nodes/${node}/status`, NodeStatusSchema);
}
