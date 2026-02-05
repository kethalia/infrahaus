/**
 * Proxmox VE storage operations
 */

import "server-only";
import type { ProxmoxClient } from "./client.js";
import type { ProxmoxStorage } from "./types.js";

/**
 * List all storage on a node
 */
export async function listStorage(
  client: ProxmoxClient,
  node: string,
): Promise<ProxmoxStorage[]> {
  return client.get<ProxmoxStorage[]>(`/nodes/${node}/storage`);
}
