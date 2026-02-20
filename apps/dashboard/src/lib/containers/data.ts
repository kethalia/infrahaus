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
import type { ServiceType, ServiceStatus } from "@/generated/prisma/client";
import { getProxmoxClient } from "@/lib/proxmox";
import { parseKeyValueString } from "@/lib/utils/parse";
import {
  listContainers,
  getContainer,
  getContainerConfig,
} from "@/lib/proxmox/containers";
import { listNodes } from "@/lib/proxmox/nodes";
import type {
  ProxmoxContainerStatus,
  ProxmoxContainerConfig,
} from "@/lib/proxmox/types";

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
  /** Services with their statuses */
  services: Array<{
    id: string;
    name: string;
    type: string;
    port: number | null;
    webUrl: string | null;
    status: ServiceStatus;
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
    servicesWithCredentials: Array<{
      id: string;
      name: string;
      type: ServiceType;
      port: number | null;
      webUrl: string | null;
      status: ServiceStatus;
      credentials: Record<string, string> | null;
    }>;
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
 */
export async function getContainersWithStatus(): Promise<DashboardData> {
  // Fetch DB data in parallel with Proxmox live status
  const [dbContainers, counts] = await Promise.all([
    DatabaseService.listContainersWithRelations(),
    DatabaseService.getContainerCounts(),
  ]);

  // If no containers, skip Proxmox call
  if (dbContainers.length === 0) {
    return {
      containers: [],
      counts,
      proxmoxReachable: true,
    };
  }

  // Try to fetch Proxmox live status
  const proxmoxStatusMap: Map<number, ProxmoxContainerStatus> = new Map();
  let proxmoxReachable = true;

  try {
    const client = await getProxmoxClient();
    const clusterNodes = await listNodes(client);
    const onlineNodes = clusterNodes.filter((n) => n.status === "online");

    // Fetch container list from all online nodes
    const allContainers = await Promise.all(
      onlineNodes.map(async (node) => {
        try {
          const containers = await listContainers(client, node.node);
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
          }));
        } catch (error) {
          // Node-level failure — continue with other nodes
          console.error(`Node ${node.node} container list failed:`, error);
          return [];
        }
      }),
    );

    // Build VMID → status map
    for (const nodeContainers of allContainers) {
      for (const c of nodeContainers) {
        proxmoxStatusMap.set(c.vmid, {
          vmid: c.vmid,
          status: c.status,
          cpu: c.cpu,
          mem: c.mem,
          maxmem: c.maxmem,
          disk: c.disk,
          maxdisk: c.maxdisk,
          uptime: c.uptime,
          name: c.name ?? undefined,
        });
      }
    }
  } catch (error) {
    // Proxmox API completely unreachable
    console.error("Proxmox API unreachable:", error);
    proxmoxReachable = false;
  }

  // Merge DB + Proxmox data
  const containers: ContainerWithStatus[] = dbContainers.map((db) =>
    mergeContainerStatus(
      db,
      proxmoxStatusMap.get(db.vmid) ?? null,
      proxmoxReachable,
    ),
  );

  return {
    containers,
    counts,
    proxmoxReachable,
  };
}

/**
 * Fetch a single container with full detail data for the detail page.
 * Includes full events list and Proxmox config.
 */
export async function getContainerDetailData(
  containerId: string,
): Promise<ContainerDetailData | null> {
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
      const client = await getProxmoxClient();
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

  const merged = mergeContainerStatus(
    dbContainer,
    proxmoxStatus,
    proxmoxReachable,
  );

  // Decrypt service credentials for detail view
  const { decrypt } = await import("@/lib/encryption");
  const servicesWithCredentials = dbContainer.services.map((s) => {
    let credentials: Record<string, string> | null = null;
    if (s.credentials) {
      try {
        const decrypted = decrypt(s.credentials);
        credentials = parseKeyValueString(decrypted);
      } catch (error) {
        // Decryption or parse failure — skip credentials
        console.error("Credential decryption failed for service:", s.id, error);
        credentials = null;
      }
    }
    return {
      id: s.id,
      name: s.name,
      type: s.type,
      port: s.port,
      webUrl: s.webUrl,
      status: s.status,
      credentials,
    };
  });

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
      servicesWithCredentials,
    },
    proxmoxReachable,
  };
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
    services: db.services.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      port: s.port,
      webUrl: s.webUrl,
      status: s.status,
    })),
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
