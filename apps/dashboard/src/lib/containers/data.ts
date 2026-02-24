import "server-only";

/**
 * Container Data Layer — server-only functions for fetching container data
 * from Proxmox as the sole source of truth, with Redis for creation state.
 *
 * Proxmox-first: all container data comes from the Proxmox API.
 * Redis provides in-progress creation state (dashboard + detail).
 * Service discovery is fetched client-side per card via useContainerServices
 * hook (TanStack Query) — the dashboard no longer merges services server-side.
 * Detail page still reads cached services from Redis for the full view.
 * No DB Container or ContainerEvent queries.
 */

import { DatabaseService } from "@/lib/db";
import { createSessionClient } from "@/lib/containers/helpers";
import { getRedis } from "@/lib/redis";
import {
  listContainers,
  getContainer,
  getContainerConfig,
} from "@/lib/proxmox/containers";
import type { ProxmoxContainerConfig } from "@/lib/proxmox/types";
import type {
  ServiceType,
  ServiceStatus,
  ServiceWithCredentials,
} from "@/lib/containers/discovery";
import {
  getCachedServices,
  decryptServiceCredentials,
} from "@/lib/containers/discovery";
import { getCreationJob, parseContainerId } from "@/lib/containers/redis-state";
import { getLogBufferKey } from "@/lib/constants/infrastructure";
import { PROXMOX_NODE_TIMEOUT_MS } from "@/lib/constants/timeouts";

// ============================================================================
// Types
// ============================================================================

/**
 * Resolved container status.
 * Dashboard only shows: running | stopped | error | unknown (from Proxmox).
 * Detail page may also return "creating" (from Redis creation state, redirects to progress page).
 */
export type ContainerStatus =
  | "running"
  | "stopped"
  | "creating"
  | "error"
  | "unknown";

/** Cached service info from Redis for dashboard display */
export interface CachedServiceInfo {
  name: string;
  type: ServiceType;
  port: number | null;
  status: ServiceStatus;
  isSystem: boolean;
}

/** Container with merged Proxmox + Redis status for dashboard display */
export interface ContainerWithStatus {
  vmid: number;
  hostname: string;
  node: { name: string; id: string };
  template: { name: string } | null;
  status: ContainerStatus;
  maxmem?: number;
  maxdisk?: number;
  maxcpu?: number;
  uptime?: number;
  netin?: number;
  netout?: number;
  /** Service cache (from Redis, populated on detail page only) */
  services?: CachedServiceInfo[];
  containerIp?: string | null;
  /** Whether this container has stored SSH credentials (dashboard-managed) */
  isManaged: boolean;
  /** Live resource usage from Proxmox (null if unavailable) */
  resources: {
    cpu: number; // percentage 0-100
    mem: number; // bytes used
    maxmem: number; // bytes total
    disk: number; // bytes used
    maxdisk: number; // bytes total
    uptime: number; // seconds
  } | null;
}

/** Dashboard data bundle */
export interface ContainersPageData {
  containers: ContainerWithStatus[];
  counts: {
    total: number;
    running: number;
    stopped: number;
    error: number;
  };
  proxmoxReachable: boolean;
  /** Names of nodes that failed to respond within timeout */
  failedNodes: string[];
}

/** Container detail page data */
export interface ContainerDetailData {
  container: ContainerWithStatus & {
    config: ProxmoxContainerConfig | null;
    containerIp: string | null;
    services: CachedServiceInfo[];
    servicesWithCredentials: ServiceWithCredentials[];
  };
  events: Array<{
    type: string;
    message: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
  proxmoxReachable: boolean;
}

// ============================================================================
// Data Fetching Functions
// ============================================================================

/**
 * Fetch all containers from Proxmox API with cached services from Redis.
 * Used by the dashboard page.
 *
 * Strategy:
 * 1. Fetch containers from Proxmox API (all user nodes in parallel, ~5s timeout per node)
 * 2. Merge cached services from Redis
 * 3. Compute counts from the container list
 * 4. Track failed nodes for error banner display
 *
 * No in-progress creations — progress page is the single place to watch creation.
 *
 * @param userId - The authenticated user's ID, used to resolve Proxmox nodes from DB
 */
export async function getContainersWithStatus(
  userId: string,
): Promise<ContainersPageData> {
  let proxmoxReachable = true;
  const failedNodes: string[] = [];

  // Collect Proxmox containers with their node info
  type PveContainerWithNode = {
    vmid: number;
    status: "running" | "stopped" | "mounted" | "paused";
    cpu: number;
    mem: number;
    maxmem: number;
    disk: number;
    maxdisk: number;
    uptime: number;
    name: string | null;
    netin: number;
    netout: number;
    cpus: number;
    node: { id: string; name: string };
  };
  const pveContainers: PveContainerWithNode[] = [];

  try {
    const userNodes = await DatabaseService.listNodesForUser(userId);

    if (userNodes.length === 0) {
      proxmoxReachable = false;
    } else {
      // Fetch container list from each node in parallel with per-node timeout
      const perNode = await Promise.all(
        userNodes.map(async (dbNode) => {
          try {
            const client = await createSessionClient(dbNode);
            // Race against timeout — skip unresponsive nodes
            let timeoutId: ReturnType<typeof setTimeout>;
            const containers = await Promise.race([
              listContainers(client, dbNode.name),
              new Promise<never>((_, reject) => {
                timeoutId = setTimeout(
                  () => reject(new Error(`Node ${dbNode.name} timed out`)),
                  PROXMOX_NODE_TIMEOUT_MS,
                );
              }),
            ]).finally(() => clearTimeout(timeoutId));
            return containers.map((c) => ({
              vmid: c.vmid,
              status: c.status as "running" | "stopped" | "mounted" | "paused",
              cpu: c.cpu ?? 0,
              mem: c.mem ?? 0,
              maxmem: c.maxmem ?? 0,
              disk: c.disk ?? 0,
              maxdisk: c.maxdisk ?? 0,
              uptime: c.uptime ?? 0,
              name: c.name ?? null,
              netin: c.netin ?? 0,
              netout: c.netout ?? 0,
              cpus: c.cpus ?? 1,
              node: {
                id: dbNode.id,
                name: dbNode.name,
              },
            }));
          } catch (error) {
            console.error(`Node ${dbNode.name} container list failed:`, error);
            failedNodes.push(dbNode.name);
            return [];
          }
        }),
      );

      for (const nodeContainers of perNode) {
        pveContainers.push(...nodeContainers);
      }

      // All nodes failed = Proxmox unreachable
      if (failedNodes.length === userNodes.length) {
        proxmoxReachable = false;
      }
    }
  } catch (error) {
    console.error("Proxmox API unreachable:", error);
    proxmoxReachable = false;
  }

  // Batch-check which containers have stored SSH credentials (managed)
  const { getManagedContainerIds } = await import("@/lib/containers/ssh-keys");
  const managedIds = await getManagedContainerIds(userId);

  // Map Proxmox containers to ContainerWithStatus
  // Services are fetched client-side per card via useContainerServices hook
  const containers: ContainerWithStatus[] = pveContainers.map((pve) => {
    // Resolve status from Proxmox live data
    let status: ContainerStatus;
    if (pve.status === "running") {
      status = "running";
    } else if (pve.status === "stopped") {
      status = "stopped";
    } else {
      status = "unknown";
    }

    const cid = `${pve.node.name}/${pve.vmid}`;

    return {
      vmid: pve.vmid,
      hostname: pve.name || `CT-${pve.vmid}`,
      node: { name: pve.node.name, id: pve.node.id },
      template: null, // Template link no longer available (was DB-only)
      status,
      isManaged: managedIds.has(cid),
      maxmem: pve.maxmem,
      maxdisk: pve.maxdisk,
      maxcpu: pve.cpus,
      uptime: pve.uptime,
      netin: pve.netin,
      netout: pve.netout,
      resources: {
        cpu: Math.round(pve.cpu * 100),
        mem: pve.mem,
        maxmem: pve.maxmem,
        disk: pve.disk,
        maxdisk: pve.maxdisk,
        uptime: pve.uptime,
      },
    };
  });

  // Sort by VMID for stable ordering
  containers.sort((a, b) => a.vmid - b.vmid);

  // Compute counts from Proxmox container list
  const counts = {
    total: containers.length,
    running: containers.filter((c) => c.status === "running").length,
    stopped: containers.filter((c) => c.status === "stopped").length,
    error: containers.filter((c) => c.status === "error").length,
  };

  return {
    containers,
    counts,
    proxmoxReachable,
    failedNodes,
  };
}

/**
 * Fetch a single container with full detail data for the detail page.
 * Uses the compound containerId (nodeName/vmid, e.g. "pve-04/601") to
 * directly target the correct node. Falls back to Redis creation state
 * for in-progress containers not yet visible on Proxmox.
 *
 * @param containerId - Compound ID "nodeName/vmid" (e.g., "pve-04/601")
 * @param userId - User ID for resolving Proxmox nodes
 */
export async function getContainerDetailData(
  containerId: string,
  userId?: string,
): Promise<ContainerDetailData | null> {
  if (!userId) return null;

  const parsed = parseContainerId(containerId);
  if (!parsed) return null;
  const { nodeName, vmid } = parsed;

  const userNodes = await DatabaseService.listNodesForUser(userId);
  const dbNode = userNodes.find((n) => n.name === nodeName);

  // Try Proxmox lookup on the specific node
  if (dbNode) {
    try {
      const client = await createSessionClient(dbNode);
      const [status, config] = await Promise.all([
        getContainer(client, dbNode.name, vmid),
        getContainerConfig(client, dbNode.name, vmid),
      ]);

      // Resolve container IP
      let containerIp: string | null = null;
      const { extractIpFromNet0 } = await import("@/lib/proxmox/utils");
      const { getRuntimeIp } = await import("@/lib/proxmox/containers");
      const net0 = (config as Record<string, unknown>)["net0"] as
        | string
        | undefined;
      if (net0) {
        containerIp = extractIpFromNet0(net0);
      }
      if (!containerIp) {
        containerIp = await getRuntimeIp(client, dbNode.name, vmid);
      }

      // Resolve status
      let resolvedStatus: ContainerStatus;
      if (status.status === "running") {
        resolvedStatus = "running";
      } else if (status.status === "stopped") {
        resolvedStatus = "stopped";
      } else {
        resolvedStatus = "unknown";
      }

      // Check if this container is managed (has stored SSH credentials)
      const { getContainerSshKey } = await import("@/lib/containers/ssh-keys");
      const hasCredential = !!(await getContainerSshKey(containerId));

      // Read cached services from Redis (keyed by compound ID)
      const redis = getRedis();
      const serviceCache = await getCachedServices(redis, containerId);
      const cachedServices: CachedServiceInfo[] = serviceCache
        ? serviceCache.services.map((s) => ({
            name: s.name,
            type: s.type,
            port: s.port,
            status: s.status,
            isSystem: s.isSystem,
          }))
        : [];

      // Use cached containerIp if Proxmox resolution failed
      if (!containerIp && serviceCache?.containerIp) {
        containerIp = serviceCache.containerIp;
      }

      // Decrypt service credentials for detail view
      const decrypted = serviceCache
        ? decryptServiceCredentials(serviceCache)
        : { services: [], containerIp: null };

      // Read creation events from Redis log buffer
      const events = await getRedisLogEvents(redis, containerId);

      const container: ContainerDetailData["container"] = {
        vmid,
        hostname: status.name ?? `CT-${vmid}`,
        node: { name: dbNode.name, id: dbNode.id },
        template: null,
        status: resolvedStatus,
        isManaged: hasCredential,
        maxmem: status.maxmem,
        maxdisk: status.maxdisk,
        maxcpu: (status as Record<string, unknown>).cpus as number | undefined,
        uptime: status.uptime,
        resources: {
          cpu: Math.round((status.cpu ?? 0) * 100),
          mem: status.mem ?? 0,
          maxmem: status.maxmem ?? 0,
          disk: status.disk ?? 0,
          maxdisk: status.maxdisk ?? 0,
          uptime: status.uptime ?? 0,
        },
        config,
        containerIp,
        services: cachedServices,
        servicesWithCredentials: decrypted.services,
      };

      return { container, events, proxmoxReachable: true };
    } catch (err) {
      // Distinguish "container not found" (404) from "node unreachable" (network error)
      const is404 =
        err instanceof Error &&
        (err.message.includes("404") ||
          err.message.includes("does not exist") ||
          err.message.includes("not found"));

      if (!is404) {
        // Node unreachable — return stub so page can show WifiOff error
        return {
          container: {
            vmid,
            hostname: `CT-${vmid}`,
            node: { name: dbNode.name, id: dbNode.id },
            template: null,
            status: "unknown" as ContainerStatus,
            isManaged: false,
            resources: null,
            config: null,
            containerIp: null,
            services: [],
            servicesWithCredentials: [],
          },
          events: [],
          proxmoxReachable: false,
        };
      }
      // 404/not-found — fall through to Redis creation state check
    }
  }

  // Not found on Proxmox — check Redis creation state
  const redis = getRedis();
  try {
    const creationJob = await getCreationJob(redis, nodeName, vmid);
    if (creationJob) {
      const events = await getRedisLogEvents(redis, containerId);
      const container: ContainerDetailData["container"] = {
        vmid,
        hostname: creationJob.hostname,
        node: { name: creationJob.nodeName, id: creationJob.nodeId },
        template: null,
        status: creationJob.lifecycle as ContainerStatus,
        isManaged: true, // Being created through dashboard = managed
        resources: null,
        config: null,
        containerIp: null,
        services: [],
        servicesWithCredentials: [],
      };
      return { container, events, proxmoxReachable: true };
    }
  } catch {
    // Redis failure — fall through to not found
  }

  // Container not found anywhere
  return null;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Read creation events from the Redis log buffer and parse to event format.
 */
async function getRedisLogEvents(
  redis: ReturnType<typeof getRedis>,
  containerId: string,
): Promise<ContainerDetailData["events"]> {
  try {
    const raw = await redis.lrange(getLogBufferKey(containerId), 0, -1);
    return raw
      .map((entry) => {
        try {
          const parsed = JSON.parse(entry) as {
            type?: string;
            message?: string;
            timestamp?: string;
            step?: string;
            percent?: number;
            scriptName?: string;
          };
          return {
            type: parsed.type ?? "log",
            message: parsed.message ?? "",
            timestamp: parsed.timestamp ?? new Date().toISOString(),
            metadata: {
              ...(parsed.step ? { step: parsed.step } : {}),
              ...(parsed.percent !== undefined
                ? { percent: parsed.percent }
                : {}),
              ...(parsed.scriptName ? { scriptName: parsed.scriptName } : {}),
            } as Record<string, unknown>,
          };
        } catch {
          return null;
        }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
  } catch {
    return [];
  }
}
