/**
 * Proxmox VE LXC container operations
 */

// Server-side module — do not import from client components
import { z } from "zod";
import type { ProxmoxClient } from "./client";
import {
  ContainerSchema,
  ContainerConfigSchema,
  ContainerStatusSchema,
} from "./schemas";
import type {
  ProxmoxContainer,
  ProxmoxContainerConfig,
  ProxmoxContainerCreateConfig,
  ProxmoxContainerStatus,
} from "./types";

/**
 * List all LXC containers on a node
 */
export async function listContainers(
  client: ProxmoxClient,
  node: string,
): Promise<ProxmoxContainer[]> {
  return client.get(`/nodes/${node}/lxc`, z.array(ContainerSchema));
}

/**
 * Create a new LXC container
 * Returns UPID for task tracking
 */
export async function createContainer(
  client: ProxmoxClient,
  node: string,
  config: ProxmoxContainerCreateConfig,
): Promise<string> {
  // Convert config to form data format that Proxmox expects
  const formData = new URLSearchParams();

  // Required parameter
  formData.append("ostemplate", config.ostemplate);

  // Optional parameters - only add if defined
  if (config.vmid !== undefined) formData.append("vmid", String(config.vmid));
  if (config.hostname) formData.append("hostname", config.hostname);
  if (config.description) formData.append("description", config.description);
  if (config.memory !== undefined)
    formData.append("memory", String(config.memory));
  if (config.swap !== undefined) formData.append("swap", String(config.swap));
  if (config.cores !== undefined)
    formData.append("cores", String(config.cores));
  if (config.cpulimit !== undefined)
    formData.append("cpulimit", String(config.cpulimit));
  if (config.cpuunits !== undefined)
    formData.append("cpuunits", String(config.cpuunits));
  if (config.rootfs) formData.append("rootfs", config.rootfs);
  if (config.net0) formData.append("net0", config.net0);
  if (config.nameserver) formData.append("nameserver", config.nameserver);
  if (config.searchdomain) formData.append("searchdomain", config.searchdomain);
  if (config.password) formData.append("password", config.password);
  if (config["ssh-public-keys"])
    formData.append("ssh-public-keys", config["ssh-public-keys"]);
  if (config.unprivileged !== undefined)
    formData.append("unprivileged", config.unprivileged ? "1" : "0");
  if (config.features) formData.append("features", config.features);
  if (config.onboot !== undefined)
    formData.append("onboot", config.onboot ? "1" : "0");
  if (config.startup) formData.append("startup", config.startup);
  if (config.storage) formData.append("storage", config.storage);
  if (config.pool) formData.append("pool", config.pool);
  if (config.tags) formData.append("tags", config.tags);
  if (config.start !== undefined)
    formData.append("start", config.start ? "1" : "0");

  return client.post(`/nodes/${node}/lxc`, formData, z.string());
}

/**
 * Get current status of a container
 */
export async function getContainer(
  client: ProxmoxClient,
  node: string,
  vmid: number,
): Promise<ProxmoxContainerStatus> {
  return client.get(
    `/nodes/${node}/lxc/${vmid}/status/current`,
    ContainerStatusSchema,
  );
}

/**
 * Get container configuration
 */
export async function getContainerConfig(
  client: ProxmoxClient,
  node: string,
  vmid: number,
): Promise<ProxmoxContainerConfig> {
  return client.get(`/nodes/${node}/lxc/${vmid}/config`, ContainerConfigSchema);
}

/**
 * Start a container
 * Returns UPID for task tracking
 */
export async function startContainer(
  client: ProxmoxClient,
  node: string,
  vmid: number,
): Promise<string> {
  return client.post(
    `/nodes/${node}/lxc/${vmid}/status/start`,
    undefined,
    z.string(),
  );
}

/**
 * Stop a container (forceful)
 * Returns UPID for task tracking
 */
export async function stopContainer(
  client: ProxmoxClient,
  node: string,
  vmid: number,
): Promise<string> {
  return client.post(
    `/nodes/${node}/lxc/${vmid}/status/stop`,
    undefined,
    z.string(),
  );
}

/**
 * Shutdown a container (graceful)
 * Returns UPID for task tracking
 */
export async function shutdownContainer(
  client: ProxmoxClient,
  node: string,
  vmid: number,
  timeout?: number,
): Promise<string> {
  const body = timeout
    ? new URLSearchParams({ timeout: String(timeout) })
    : undefined;
  return client.post(
    `/nodes/${node}/lxc/${vmid}/status/shutdown`,
    body,
    z.string(),
  );
}

/**
 * Delete a container
 * Returns UPID for task tracking
 */
export async function deleteContainer(
  client: ProxmoxClient,
  node: string,
  vmid: number,
  purge = false,
): Promise<string> {
  const path = `/nodes/${node}/lxc/${vmid}${purge ? "?purge=1" : ""}`;
  return client.delete(path, z.string());
}

/**
 * Get runtime IP address from Proxmox guest agent
 * Queries the container's network interfaces via the guest agent to find
 * the actual assigned IP address (useful for DHCP containers where the
 * config only shows "ip=dhcp" but not the actual IP).
 *
 * Returns the first non-loopback IPv4 address, or null if not found.
 * Returns null on any error (container stopped, agent not running, etc.).
 */
export async function getRuntimeIp(
  client: ProxmoxClient,
  nodeName: string,
  vmid: number,
): Promise<string | null> {
  try {
    // Query Proxmox guest agent for network interfaces
    const response = await client.get(
      `/nodes/${nodeName}/lxc/${vmid}/agent/network-get-interfaces`,
      z.object({
        result: z.array(
          z.object({
            name: z.string(),
            "ip-addresses": z
              .array(
                z.object({
                  "ip-address": z.string(),
                  "ip-address-type": z.string(),
                  prefix: z.number().optional(),
                }),
              )
              .optional(),
          }),
        ),
      }),
    );

    // Find first non-loopback interface with valid IPv4 address
    for (const iface of response.result) {
      // Skip loopback
      if (iface.name === "lo") continue;

      const addresses = iface["ip-addresses"];
      if (!addresses) continue;

      // Find first IPv4 address
      for (const addr of addresses) {
        if (addr["ip-address-type"] === "ipv4") {
          const ip = addr["ip-address"];
          // Skip loopback IPs
          if (ip.startsWith("127.")) continue;
          // Return IP without CIDR suffix (already without it from agent)
          return ip;
        }
      }
    }

    return null;
  } catch (err) {
    // Return null on any error (agent not running, container stopped, etc.)
    // Don't log - expected for stopped containers or containers without agent
    return null;
  }
}
