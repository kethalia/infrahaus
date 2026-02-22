import "server-only";

/**
 * Container Data Layer — server-only functions for fetching container data
 * with merged Proxmox live status.
 *
 * Used by the dashboard page and container detail page for server-side
 * data fetching with Proxmox status synchronization.
 */

import {
  DatabaseService,
  type ContainerWithRelations,
  type ContainerWithDetails,
  type ContainerCounts,
} from "@/lib/db";
import { createSessionClient } from "@/lib/containers/helpers";
import { getRedis } from "@/lib/redis";
import {
  listContainers,
  getContainer,
  getContainerConfig,
} from "@/lib/proxmox/containers";
import type {
  ProxmoxContainerStatus,
  ProxmoxContainerConfig,
} from "@/lib/proxmox/types";
import type {
  ServiceType,
  ServiceStatus,
  ServiceWithCredentials,
} from "@/lib/containers/discovery";
import {
  getCachedServices,
  decryptServiceCredentials,
} from "@/lib/containers/discovery";

// ============================================================================
// Types
// ============================================================================

/** Resolved container status combining DB lifecycle + Proxmox live status */
export type ContainerStatus =
  | "running"
  | "stopped"
  | "creating"
  | "error"
  | "unknown";

/** Container with merged DB + Proxmox status for dashboard display */
export interface ContainerWithStatus {
  id: string;
  vmid: number;
  hostname: string | null;
  lifecycle: string;
  status: ContainerStatus;
  createdAt: Date;
  updatedAt: Date;
  /** Node info */
  node: { id: string; name: string; host: string; port: number };
  /** Template info (if created from template) */
  template: { id: string; name: string } | null;
  /** Services from Redis cache */
  services: Array<{
    name: string;
    type: ServiceType;
    port: number | null;
    status: ServiceStatus;
    isSystem: boolean;
  }>;
  /** Latest events (up to 3) */
  events: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: Date;
  }>;
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
export interface DashboardData {
  containers: ContainerWithStatus[];
  counts: ContainerCounts;
  proxmoxReachable: boolean;
}

/** Container detail page data */
export interface ContainerDetailData {
  container: ContainerWithStatus & {
    /** Full events list (not limited to 3) */
    allEvents: Array<{
      id: string;
      type: string;
      message: string;
      metadata: string | null;
      createdAt: Date;
    }>;
    /** Proxmox configuration (if available) */
    config: ProxmoxContainerConfig | null;
    /** Resolved container IP (static or DHCP — null if unknown) */
    containerIp: string | null;
    /** Services with decrypted credentials for detail view */
    servicesWithCredentials: ServiceWithCredentials[];
  };
  proxmoxReachable: boolean;
}

// ============================================================================
// Data Fetching Functions
// ============================================================================

/**
 * Fetch all containers with merged Proxmox live status.
 * Used by the dashboard page.
 *
 * Strategy:
 * - Creating containers → status = "creating"
 * - Error containers → status = "error"
 * - Ready containers → use Proxmox live status (running/stopped)
 * - Proxmox API failure → status = "unknown" for ready containers
 *
 * @param userId - The authenticated user's ID, used to resolve Proxmox nodes from DB
 */
export async function getContainersWithStatus(
  userId: string,
): Promise<DashboardData> {
  // Proxmox is the source of truth — fetch live containers from all user nodes
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
    node: { id: string; name: string; host: string; port: number };
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
              node: {
                id: dbNode.id,
                name: dbNode.name,
                host: dbNode.host,
                port: dbNode.port,
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

  // Fetch DB records for enrichment (template, events, services, lifecycle)
  const dbContainers = await DatabaseService.listContainersWithRelations();
  const dbByVmid = new Map(dbContainers.map((db) => [db.vmid, db]));

  // Fetch cached services from Redis for DB-tracked containers
  const redis = getRedis();
  const serviceCacheMap = new Map<
    string,
    Array<{
      name: string;
      type: ServiceType;
      port: number | null;
      status: ServiceStatus;
      isSystem: boolean;
    }>
  >();
  try {
    const cachePromises = dbContainers.map(async (db) => {
      const cache = await getCachedServices(redis, db.id);
      if (cache) {
        serviceCacheMap.set(
          db.id,
          cache.services.map((s) => ({
            name: s.name,
            type: s.type,
            port: s.port,
            status: s.status,
            isSystem: s.isSystem,
          })),
        );
      }
    });
    await Promise.all(cachePromises);
  } catch {
    // Redis failure is non-fatal
  }

  // Track which DB containers appeared in Proxmox (for "creating" containers that aren't on PVE yet)
  const seenVmids = new Set<number>();

  // Build container list: Proxmox is primary, DB enriches
  const containers: ContainerWithStatus[] = pveContainers.map((pve) => {
    seenVmids.add(pve.vmid);
    const db = dbByVmid.get(pve.vmid);

    // Resolve status from Proxmox live data
    let status: ContainerStatus;
    if (pve.status === "running") {
      status = "running";
    } else if (pve.status === "stopped") {
      status = "stopped";
    } else {
      status = "unknown";
    }

    return {
      // Use DB id if tracked, otherwise synthesize from vmid
      id: db?.id ?? `pve-${pve.vmid}`,
      vmid: pve.vmid,
      hostname: pve.name ?? db?.hostname ?? null,
      lifecycle: db?.lifecycle ?? "ready",
      status,
      createdAt: db?.createdAt ?? new Date(),
      updatedAt: db?.updatedAt ?? new Date(),
      node: pve.node,
      template: db?.template
        ? { id: db.template.id, name: db.template.name }
        : null,
      services: db ? (serviceCacheMap.get(db.id) ?? []) : [],
      events: db
        ? ("events" in db ? db.events : []).slice(0, 3).map((e) => ({
            id: e.id,
            type: e.type,
            message: e.message,
            createdAt: e.createdAt,
          }))
        : [],
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

  // Add DB-only containers not found on Proxmox (e.g. "creating" or "error" lifecycle)
  for (const db of dbContainers) {
    if (seenVmids.has(db.vmid)) continue;

    containers.push(
      mergeContainerStatus(
        db,
        null,
        proxmoxReachable,
        serviceCacheMap.get(db.id) ?? [],
      ),
    );
  }

  // Sort by VMID for stable ordering
  containers.sort((a, b) => a.vmid - b.vmid);

  // Compute counts from the merged list
  const counts: ContainerCounts = {
    total: containers.length,
    creating: containers.filter((c) => c.status === "creating").length,
    ready: containers.filter(
      (c) => c.status === "running" || c.status === "stopped",
    ).length,
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
 * Includes full events list and Proxmox config.
 *
 * Supports two ID formats:
 * - DB cuid (e.g. "cmlvbua8q0002swsp9y8y3l10") — DB-tracked container
 * - Proxmox synthetic ID (e.g. "pve-601") — Proxmox-only container, fetched live
 *
 * @param containerId - DB id or "pve-{vmid}" for untracked containers
 * @param userId - Required for Proxmox-only containers (to resolve nodes)
 */
export async function getContainerDetailData(
  containerId: string,
  userId?: string,
): Promise<ContainerDetailData | null> {
  // Handle Proxmox-only containers (synthetic pve-{vmid} IDs from dashboard)
  if (containerId.startsWith("pve-") && userId) {
    return getProxmoxOnlyContainerDetail(containerId, userId);
  }

  // Standard DB-tracked container path
  const dbContainer =
    await DatabaseService.getContainerWithDetails(containerId);
  if (!dbContainer) {
    return null;
  }

  let proxmoxStatus: ProxmoxContainerStatus | null = null;
  let proxmoxConfig: ProxmoxContainerConfig | null = null;
  let proxmoxReachable = true;
  let containerIp: string | null = null;

  // Only fetch Proxmox data for ready containers
  if (dbContainer.lifecycle === "ready") {
    try {
      const client = await createSessionClient(dbContainer.node);
      const [status, config] = await Promise.all([
        getContainer(client, dbContainer.node.name, dbContainer.vmid),
        getContainerConfig(client, dbContainer.node.name, dbContainer.vmid),
      ]);
      proxmoxStatus = status;
      proxmoxConfig = config;

      // Resolve container IP (static from net0, or live interfaces for DHCP)
      const { extractIpFromNet0 } = await import("@/lib/proxmox/utils");
      const { getRuntimeIp } = await import("@/lib/proxmox/containers");
      const net0 = (config as Record<string, unknown>)["net0"] as
        | string
        | undefined;
      if (net0) {
        containerIp = extractIpFromNet0(net0);
      }
      if (!containerIp) {
        containerIp = await getRuntimeIp(
          client,
          dbContainer.node.name,
          dbContainer.vmid,
        );
      }
    } catch (error) {
      console.error(
        `Container ${dbContainer.vmid} detail fetch failed:`,
        error,
      );
      proxmoxReachable = false;
    }
  }

  // Read services from Redis cache
  const redis = getRedis();
  const serviceCache = await getCachedServices(redis, containerId);
  const cachedServices = serviceCache
    ? serviceCache.services.map((s) => ({
        name: s.name,
        type: s.type,
        port: s.port,
        status: s.status,
        isSystem: s.isSystem,
      }))
    : [];

  // Use containerIp from Redis cache if Proxmox resolution failed
  if (!containerIp && serviceCache?.containerIp) {
    containerIp = serviceCache.containerIp;
  }

  const merged = mergeContainerStatus(
    dbContainer,
    proxmoxStatus,
    proxmoxReachable,
    cachedServices,
  );

  // Decrypt service credentials for detail view
  const decrypted = serviceCache
    ? decryptServiceCredentials(serviceCache)
    : { services: [], containerIp: null };

  return {
    container: {
      ...merged,
      allEvents: dbContainer.events.map((e) => ({
        id: e.id,
        type: e.type,
        message: e.message,
        metadata: e.metadata,
        createdAt: e.createdAt,
      })),
      config: proxmoxConfig,
      containerIp,
      servicesWithCredentials: decrypted.services,
    },
    proxmoxReachable,
  };
}

/**
 * Fetch detail data for a Proxmox-only container (not tracked in DB).
 * Searches all user nodes for the VMID and returns live Proxmox data.
 */
async function getProxmoxOnlyContainerDetail(
  containerId: string,
  userId: string,
): Promise<ContainerDetailData | null> {
  const vmid = parseInt(containerId.replace("pve-", ""), 10);
  if (isNaN(vmid)) return null;

  const userNodes = await DatabaseService.listNodesForUser(userId);

  // Search each node for this VMID
  for (const dbNode of userNodes) {
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

      const container: ContainerDetailData["container"] = {
        id: containerId,
        vmid,
        hostname: status.name ?? null,
        lifecycle: "ready",
        status: resolvedStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
        node: {
          id: dbNode.id,
          name: dbNode.name,
          host: dbNode.host,
          port: dbNode.port,
        },
        template: null,
        services: [],
        events: [],
        resources: {
          cpu: Math.round((status.cpu ?? 0) * 100),
          mem: status.mem ?? 0,
          maxmem: status.maxmem ?? 0,
          disk: status.disk ?? 0,
          maxdisk: status.maxdisk ?? 0,
          uptime: status.uptime ?? 0,
        },
        allEvents: [],
        config,
        containerIp,
        servicesWithCredentials: [],
      };

      return { container, proxmoxReachable: true };
    } catch {
      // Container not on this node — try next
      continue;
    }
  }

  // VMID not found on any node
  return null;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Merge a DB container record with Proxmox live status.
 *
 * Hostname resolution priority:
 * 1. Proxmox live data (most current)
 * 2. Database hostname field (fallback when Proxmox unreachable)
 * 3. null (display as "CT {vmid}")
 *
 * Status resolution:
 * - creating/error: from DB lifecycle
 * - running/stopped: from Proxmox live data
 * - unknown: when Proxmox is unreachable, the container is not found, or
 *   Proxmox reports a state that does not map to running/stopped (e.g. paused/mounted)
 */
function mergeContainerStatus(
  db: ContainerWithRelations | ContainerWithDetails,
  proxmox: ProxmoxContainerStatus | null,
  proxmoxReachable: boolean,
  services: Array<{
    name: string;
    type: ServiceType;
    port: number | null;
    status: ServiceStatus;
    isSystem: boolean;
  }> = [],
): ContainerWithStatus {
  // Determine resolved status
  let status: ContainerStatus;

  if (db.lifecycle === "creating") {
    status = "creating";
  } else if (db.lifecycle === "error") {
    status = "error";
  } else if (proxmox) {
    // Ready container with live Proxmox status
    if (proxmox.status === "running") {
      status = "running";
    } else if (proxmox.status === "stopped") {
      status = "stopped";
    } else {
      // Non-running, non-stopped states (e.g. paused, mounted)
      status = "unknown";
    }
  } else if (!proxmoxReachable) {
    // Proxmox API unreachable — can't determine status
    status = "unknown";
  } else {
    // Proxmox reachable but container not found — likely deleted externally
    status = "unknown";
  }

  // Extract hostname from Proxmox data or fallback to DB stored hostname
  const hostname = proxmox?.name ?? db.hostname ?? null;

  return {
    id: db.id,
    vmid: db.vmid,
    hostname,
    lifecycle: db.lifecycle,
    status,
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
    node: {
      id: db.node.id,
      name: db.node.name,
      host: db.node.host,
      port: db.node.port,
    },
    template: db.template
      ? { id: db.template.id, name: db.template.name }
      : null,
    services,
    events: ("events" in db ? db.events : []).slice(0, 3).map((e) => ({
      id: e.id,
      type: e.type,
      message: e.message,
      createdAt: e.createdAt,
    })),
    resources: proxmox
      ? {
          cpu: Math.round((proxmox.cpu ?? 0) * 100),
          mem: proxmox.mem ?? 0,
          maxmem: proxmox.maxmem ?? 0,
          disk: proxmox.disk ?? 0,
          maxdisk: proxmox.maxdisk ?? 0,
          uptime: proxmox.uptime ?? 0,
        }
      : null,
  };
}
