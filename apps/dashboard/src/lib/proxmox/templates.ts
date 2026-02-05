/**
 * Proxmox VE OS template operations
 */

import "server-only";
import type { ProxmoxClient } from "./client.js";
import type { ProxmoxTemplate } from "./types.js";

/**
 * List available OS templates (aplinfo)
 */
export async function listTemplates(
  client: ProxmoxClient,
  node: string,
): Promise<ProxmoxTemplate[]> {
  return client.get<ProxmoxTemplate[]>(`/nodes/${node}/aplinfo`);
}
