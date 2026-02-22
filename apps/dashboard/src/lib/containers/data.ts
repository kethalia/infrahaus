import "server-only";

/**
 * Container Data Layer — server-only functions for fetching container data
 * from Proxmox as the sole source of truth, with Redis for creation state
 * and service caching.
 *
 * Proxmox-first: all container data comes from the Proxmox API.
 * Redis provides in-progress creation state and cached service discovery.
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
import {
  listActiveCreations,
  getCreationJob,
  toContainerId,
  parseContainerId,
} from "@/lib/containers/redis-state";
import { getLogBufferKey } from "@/lib/constants/infrastructure";

// ============================================================================
// Types
// ============================================================================

/** Resolved container status combining Proxmox live status + Redis creation state */
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
  /** Service cache (from Redis) */
  services?: CachedServiceInfo[];
  serviceCount?: number;
  containerIp?: string | null;
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
    creating: number;
    error: number;
  };
  proxmoxReachable: boolean;
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
 * Fetch all containers with merged Proxmox live status + Redis creation state.
 * Used by the dashboard page.
 *
 * Strategy:
 * 1. Fetch containers from Proxmox API (all user nodes in parallel)
 * 2. Merge cached services from Redis
 * 3. Merge in-progress creations from Redis that aren't yet visible in Proxmox
 * 4. Compute counts from the merged list
 *
 * @param userId - The authenticated user's ID, used to resolve Proxmox nodes from DB
 */
export async function getContainersWithStatus(
  userId: string,
): Promise<ContainersPageData> {
  let proxmoxReachable = true;

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
      // Fetch container list from each node in parallel
      const perNode = await Promise.all(
        userNodes.map(async (dbNode) => {
          try {
            const client = await createSessionClient(dbNode);
            const containers = await listContainers(client, dbNode.name);
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
            return [];
          }
        }),
      );

      for (const nodeContainers of perNode) {
        pveContainers.push(...nodeContainers);
      }
    }
  } catch (error) {
    console.error("Proxmox API unreachable:", error);
    proxmoxReachable = false;
  }

  // Fetch cached services from Redis for all Proxmox containers (keyed by nodeName/vmid)
  const redis = getRedis();
  const servicesByKey = new Map<
    string,
    {
      services: CachedServiceInfo[];
      serviceCount: number;
      containerIp: string | null;
    }
  >();
  try {
    const cachePromises = pveContainers.map(async (pve) => {
      const cacheKey = toContainerId(pve.node.name, pve.vmid);
      const cache = await getCachedServices(redis, cacheKey);
      if (cache) {
        servicesByKey.set(cacheKey, {
          services: cache.services.map((s) => ({
            name: s.name,
            type: s.type,
            port: s.port,
            status: s.status,
            isSystem: s.isSystem,
          })),
          serviceCount: cache.services.length,
          containerIp: cache.containerIp,
        });
      }
    });
    await Promise.all(cachePromises);
  } catch {
    // Redis failure is non-fatal
  }

  // Fetch Redis creation state for in-progress containers
  let activeCreations: Awaited<ReturnType<typeof listActiveCreations>> = [];
  try {
    activeCreations = await listActiveCreations(redis);
  } catch {
    // Redis failure is non-fatal
  }

  // Map Proxmox containers to ContainerWithStatus
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

    const cached = servicesByKey.get(toContainerId(pve.node.name, pve.vmid));

    return {
      vmid: pve.vmid,
      hostname: pve.name || `CT-${pve.vmid}`,
      node: { name: pve.node.name, id: pve.node.id },
      template: null, // Template link no longer available (was DB-only)
      status,
      maxmem: pve.maxmem,
      maxdisk: pve.maxdisk,
      maxcpu: pve.cpus,
      uptime: pve.uptime,
      netin: pve.netin,
      netout: pve.netout,
      services: cached?.services,
      serviceCount: cached?.serviceCount,
      containerIp: cached?.containerIp,
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

  // Add Redis creation state containers not yet visible in Proxmox
  const pveKeys = new Set(
    pveContainers.map((p) => toContainerId(p.node.name, p.vmid)),
  );
  for (const creation of activeCreations) {
    if (!pveKeys.has(toContainerId(creation.nodeName, creation.vmid))) {
      containers.push({
        vmid: creation.vmid,
        hostname: creation.hostname,
        node: { name: creation.nodeName, id: creation.nodeId },
        template: null,
        status: creation.lifecycle as ContainerStatus, // "creating" or "error"
        resources: null,
      });
    }
  }

  // Sort by VMID for stable ordering
  containers.sort((a, b) => a.vmid - b.vmid);

  // Compute counts from the merged list
  const counts = {
    total: containers.length,
    running: containers.filter((c) => c.status === "running").length,
    stopped: containers.filter((c) => c.status === "stopped").length,
    creating: containers.filter((c) => c.status === "creating").length,
    error: containers.filter((c) => c.status === "error").length,
  };

  return {
    containers,
    counts,
    proxmoxReachable,
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
    } catch {
      // Container not found on this node — fall through to Redis creation state
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
