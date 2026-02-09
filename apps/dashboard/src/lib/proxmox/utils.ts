// No "server-only" — may be used by worker process

/**
 * Proxmox-specific parsing utilities.
 */

/**
 * Extract IP address from a Proxmox net0 config string.
 *
 * Proxmox stores network config as comma-separated key=value pairs:
 *   "name=eth0,bridge=vmbr0,ip=10.0.0.5/24,gw=10.0.0.1"
 *
 * Returns the IP without CIDR mask, or null if not found / DHCP / manual.
 */
export function extractIpFromNet0(net0: string): string | null {
  const ipMatch = net0.match(/ip=([^,/]+)/);
  if (!ipMatch) return null;
  const ip = ipMatch[1];
  if (ip === "dhcp" || ip === "manual") return null;
  return ip;
}
