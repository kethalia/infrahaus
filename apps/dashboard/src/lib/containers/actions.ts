"use server";

/**
 * Container Server Actions
 *
 * Server actions for creating containers, fetching wizard initialization data,
 * and managing container lifecycle (start/stop/shutdown/restart/delete).
 * Uses authActionClient for authenticated access and next-safe-action patterns.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authActionClient, ActionError } from "@/lib/safe-action";
import { DatabaseService, EventType, prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { getContainerCreationQueue } from "@/lib/queue/container-creation";
import {
  getProxmoxClient,
  storage,
  nodes as proxmoxNodes,
  templates as proxmoxTemplates,
} from "@/lib/proxmox";
import {
  startContainer,
  stopContainer,
  shutdownContainer,
  deleteContainer,
  getContainer,
} from "@/lib/proxmox/containers";
import { waitForTask } from "@/lib/proxmox/tasks";
import { getRedis } from "@/lib/redis";
import { createContainerInputSchema } from "./schemas";

// ============================================================================
// Types for wizard data
// ============================================================================

export interface WizardTemplate {
  id: string;
  name: string;
  description: string | null;
  osTemplate: string | null;
  cores: number | null;
  memory: number | null;
  swap: number | null;
  diskSize: number | null;
  storage: string | null;
  bridge: string | null;
  unprivileged: boolean;
  nesting: boolean;
  tags: string | null;
  packages: Array<{ id: string; name: string; manager: string }>;
  scripts: Array<{
    id: string;
    name: string;
    order: number;
    enabled: boolean;
    description: string | null;
  }>;
}

export interface WizardStorage {
  node: string; // which Proxmox node this storage is on
  storage: string;
  type: string;
  content?: string;
}

export interface WizardBridge {
  node: string; // which Proxmox node this bridge is on
  iface: string;
  type: string;
}

export interface WizardOsTemplate {
  node: string; // which Proxmox node this template is on
  volid: string; // "local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst"
  name: string; // "debian-12-standard_12.7-1_amd64" (human-readable, extracted from volid)
  size: number; // bytes
}

export interface WizardNode {
  node: string; // Proxmox node name (e.g., "pve-04")
  status: string; // "online" | "offline" | "unknown"
  maxcpu?: number;
  maxmem?: number; // bytes
}

export interface WizardData {
  templates: WizardTemplate[];
  storages: WizardStorage[];
  bridges: WizardBridge[];
  nextVmid: number;
  noNodeConfigured: boolean;
  osTemplates: WizardOsTemplate[];
  clusterNodes: WizardNode[];
}

// ============================================================================
// Proxmox Node Helpers
// ============================================================================

/**
 * Get or create a ProxmoxNode DB record for the given target node.
 * Auto-creates a DB record using PVE_HOST/PVE_PORT from env vars if one
 * doesn't exist yet. Uses env-based auth (no session needed).
 */
async function getOrCreateNode(
  targetNode?: string,
): Promise<{ nodeId: string; nodeName: string }> {
  // If a target node is specified, look for it in DB first
  if (targetNode) {
    const existing = await DatabaseService.getNodeByName(targetNode);
    if (existing) {
      return { nodeId: existing.id, nodeName: existing.name };
    }
  }

  // Check if any nodes exist in DB
  const existingNodes = await DatabaseService.listNodes();
  if (!targetNode && existingNodes.length > 0) {
    return { nodeId: existingNodes[0].id, nodeName: existingNodes[0].name };
  }

  // Need to create a DB record for the target node
  const host = process.env.PVE_HOST;
  if (!host) {
    throw new Error("PVE_HOST env var is not set.");
  }
  const port = process.env.PVE_PORT ? parseInt(process.env.PVE_PORT, 10) : 8006;

  // Use target node name, or discover from API
  let nodeName = targetNode;
  if (!nodeName) {
    const client = await getProxmoxClient();
    const clusterNodes = await proxmoxNodes.listNodes(client);
    nodeName = clusterNodes[0]?.node || "pve";
  }

  // Create a DB record with placeholder token fields (env auth used)
  const placeholderToken = encrypt("env-auth-no-token");
  const node = await DatabaseService.createNode({
    name: nodeName,
    host,
    port,
    tokenId: "root@pam!env",
    tokenSecret: placeholderToken,
  });

  return { nodeId: node.id, nodeName: node.name };
}

// ============================================================================
// Fetch wizard initialization data
// ============================================================================

/**
 * Fetches all data needed to initialize the container creation wizard.
 * Uses env-based auth via getProxmoxClient() — no user session needed.
 */
export async function getWizardData(): Promise<WizardData> {
  // Fetch templates from database
  const templates = await prisma.template.findMany({
    include: {
      packages: true,
      scripts: { orderBy: { order: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  const emptyResult: WizardData = {
    templates: templates.map(mapTemplate),
    storages: [],
    bridges: [],
    nextVmid: 100,
    noNodeConfigured: true,
    osTemplates: [],
    clusterNodes: [],
  };

  // Check env vars are configured
  if (!process.env.PVE_HOST || !process.env.PVE_ROOT_PASSWORD) {
    return emptyResult;
  }

  try {
    const client = await getProxmoxClient();

    // Fetch cluster nodes and next VMID
    const [clusterNodeList, nextVmidResponse] = await Promise.all([
      proxmoxNodes.listNodes(client),
      client.get("/cluster/nextid", z.coerce.number()),
    ]);

    const onlineNodes = clusterNodeList.filter((n) => n.status === "online");

    // Fetch storages, bridges, and OS templates for EACH online node in parallel
    const perNodeData = await Promise.all(
      onlineNodes.map(async (clusterNode) => {
        const nn = clusterNode.node;

        const [storageList, networkList] = await Promise.all([
          storage.listStorage(client, nn),
          client.get(
            `/nodes/${nn}/network`,
            z.array(
              z
                .object({
                  iface: z.string(),
                  type: z.string(),
                })
                .passthrough(),
            ),
          ),
        ]);

        // Filter storages that support container rootdir/images content
        const containerStorages = storageList.filter(
          (s) =>
            s.content?.includes("rootdir") || s.content?.includes("images"),
        );

        // Filter for bridge interfaces only
        const bridges = networkList.filter((n) => n.type === "bridge");

        // Find storages that support vztmpl content and fetch their templates
        const vztmplStorages = storageList.filter((s) =>
          s.content?.includes("vztmpl"),
        );
        const osTemplatesResults = await Promise.all(
          vztmplStorages.map((s) =>
            proxmoxTemplates
              .listDownloadedTemplates(client, nn, s.storage)
              .catch(() => []),
          ),
        );

        // Map OS templates with node info
        const osTemplates: WizardOsTemplate[] = osTemplatesResults
          .flat()
          .map((template) => {
            const volidParts = template.volid.split("/");
            let name = volidParts[volidParts.length - 1];
            name = name.replace(/\.(tar\.zst|tar\.gz|tar\.xz)$/, "");
            return {
              node: nn,
              volid: template.volid,
              name,
              size: template.size,
            };
          });

        return {
          node: nn,
          storages: containerStorages.map((s) => ({
            node: nn,
            storage: s.storage,
            type: s.type,
            content: s.content,
          })),
          bridges: bridges.map((b) => ({
            node: nn,
            iface: b.iface,
            type: b.type,
          })),
          osTemplates,
        };
      }),
    );

    // Flatten per-node data into single arrays
    const allStorages = perNodeData.flatMap((d) => d.storages);
    const allBridges = perNodeData.flatMap((d) => d.bridges);
    const allOsTemplates = perNodeData.flatMap((d) => d.osTemplates);

    return {
      templates: templates.map(mapTemplate),
      storages: allStorages,
      bridges: allBridges,
      nextVmid: nextVmidResponse,
      noNodeConfigured: false,
      osTemplates: allOsTemplates,
      clusterNodes: onlineNodes.map((n) => ({
        node: n.node,
        status: n.status,
        maxcpu: n.maxcpu,
        maxmem: n.maxmem,
      })),
    };
  } catch (error) {
    console.error("Failed to fetch Proxmox data for wizard:", error);
    // Return templates but empty Proxmox data — user can still fill in manually
    return {
      templates: templates.map(mapTemplate),
      storages: [],
      bridges: [],
      nextVmid: 100,
      noNodeConfigured: false,
      osTemplates: [],
      clusterNodes: [],
    };
  }
}

/**
 * Map a Prisma template to the wizard-friendly shape.
 */
function mapTemplate(t: {
  id: string;
  name: string;
  description: string | null;
  osTemplate: string | null;
  cores: number | null;
  memory: number | null;
  swap: number | null;
  diskSize: number | null;
  storage: string | null;
  bridge: string | null;
  unprivileged: boolean;
  nesting: boolean;
  tags: string | null;
  packages: Array<{ id: string; name: string; manager: string }>;
  scripts: Array<{
    id: string;
    name: string;
    order: number;
    enabled: boolean;
    description: string | null;
  }>;
}): WizardTemplate {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    osTemplate: t.osTemplate,
    cores: t.cores,
    memory: t.memory,
    swap: t.swap,
    diskSize: t.diskSize,
    storage: t.storage,
    bridge: t.bridge,
    unprivileged: t.unprivileged,
    nesting: t.nesting,
    tags: t.tags,
    packages: t.packages.map((p) => ({
      id: p.id,
      name: p.name,
      manager: p.manager,
    })),
    scripts: t.scripts.map((s) => ({
      id: s.id,
      name: s.name,
      order: s.order,
      enabled: s.enabled,
      description: s.description,
    })),
  };
}

// ============================================================================
// Create container action
// ============================================================================

/**
 * Create a new container record and enqueue a BullMQ job for provisioning.
 *
 * 1. Validates input via Zod
 * 2. Finds first Proxmox node
 * 3. Encrypts root password for DB storage
 * 4. Creates Container record
 * 5. Resolves OS template path
 * 6. Enqueues BullMQ job with plaintext password (Proxmox API needs it)
 * 7. Returns container ID for redirect
 */
export const createContainerAction = authActionClient
  .schema(createContainerInputSchema)
  .action(async ({ parsedInput: data }) => {
    // Get or create a Proxmox node DB record for the target node
    const { nodeId, nodeName } = await getOrCreateNode(data.targetNode);

    // Encrypt password for DB storage
    const encryptedPassword = encrypt(data.rootPassword);

    // Create container record — handle VMID conflicts from stale records
    let container;
    try {
      container = await DatabaseService.createContainer({
        vmid: data.vmid,
        rootPassword: encryptedPassword,
        nodeId,
        templateId: data.templateId || undefined,
      });
    } catch (err: unknown) {
      // Check for Prisma unique constraint violation on vmid
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "P2002"
      ) {
        // Try to clean up stale record from a previous failed creation
        const existing = await prisma.container.findUnique({
          where: { vmid: data.vmid },
          select: { id: true, lifecycle: true },
        });

        if (existing) {
          // DB has a record for this VMID — check if the container actually
          // still exists on Proxmox before deciding what to do.
          const client = await getProxmoxClient();
          let existsOnProxmox = false;
          try {
            // Try to fetch the container status from the target node
            const targetNode = data.targetNode || nodeName;
            await client.get(
              `/nodes/${targetNode}/lxc/${data.vmid}/status/current`,
              z.object({}).passthrough(),
            );
            existsOnProxmox = true;
          } catch {
            // 500/404 = container doesn't exist on this node
            existsOnProxmox = false;
          }

          if (existsOnProxmox) {
            throw new ActionError(
              `VMID ${data.vmid} is already in use by an active container. Please choose a different VMID.`,
            );
          }

          // Container gone from Proxmox — safe to clean up stale DB record
          await prisma.containerEvent.deleteMany({
            where: { containerId: existing.id },
          });
          await prisma.containerService.deleteMany({
            where: { containerId: existing.id },
          });
          await prisma.container.delete({ where: { id: existing.id } });

          container = await DatabaseService.createContainer({
            vmid: data.vmid,
            rootPassword: encryptedPassword,
            nodeId,
            templateId: data.templateId || undefined,
          });
        } else {
          throw new ActionError(
            `VMID ${data.vmid} is already in use. Please choose a different VMID.`,
          );
        }
      } else {
        throw err;
      }
    }

    // Resolve OS template path
    const ostemplate = data.ostemplate || "";
    if (!ostemplate) {
      throw new ActionError(
        "OS template is required. Please select an OS template in the Configure step.",
      );
    }

    // Enqueue creation job — worker self-authenticates via env vars
    const queue = getContainerCreationQueue();
    await queue.add("create-container", {
      containerId: container.id,
      nodeId,
      nodeName,
      templateId: data.templateId || null,
      config: {
        hostname: data.hostname,
        vmid: data.vmid,
        memory: data.memory,
        swap: data.swap,
        cores: data.cores,
        diskSize: data.diskSize,
        storage: data.storage,
        bridge: data.bridge,
        ipConfig: data.ipConfig,
        nameserver: data.nameserver,
        rootPassword: data.rootPassword, // Plaintext — Proxmox API needs it
        sshPublicKey: data.sshPublicKey,
        unprivileged: data.unprivileged,
        nesting: data.nesting,
        ostemplate,
        tags: data.tags,
      },
      enabledBuckets: data.enabledBuckets,
      additionalPackages: data.additionalPackages,
      scripts: data.scripts,
    });

    revalidatePath("/containers");

    return { containerId: container.id };
  });

// ============================================================================
// Lifecycle Server Actions
// ============================================================================

/** Shared input schema for lifecycle actions */
const containerIdSchema = z.object({
  containerId: z.string(),
});

/** Redis lock key prefix for container lifecycle operations */
const LOCK_PREFIX = "container-lock:";

/**
 * Lock TTL in seconds — prevents stuck locks from blocking forever.
 * Must exceed the longest possible action duration. The delete action
 * waits up to 120s for stop + 120s for delete = 240s, so 300s provides
 * a comfortable margin.
 */
const LOCK_TTL = 300;

/**
 * Lua script for compare-and-delete: only deletes the key if its value
 * matches the ownership token. Prevents one action from releasing another
 * action's lock after TTL-based expiry and re-acquisition.
 */
const RELEASE_LOCK_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

/**
 * Acquire a Redis lock for a container. Prevents concurrent lifecycle
 * actions on the same container.
 * @returns the ownership token if lock acquired, null if already locked
 */
async function acquireContainerLock(
  containerId: string,
): Promise<string | null> {
  const redis = getRedis();
  const token = crypto.randomUUID();
  const result = await redis.set(
    `${LOCK_PREFIX}${containerId}`,
    token,
    "EX",
    LOCK_TTL,
    "NX",
  );
  return result === "OK" ? token : null;
}

/**
 * Release a Redis lock for a container.
 * Uses a Lua compare-and-delete script to ensure we only release our own lock.
 */
async function releaseContainerLock(
  containerId: string,
  token: string,
): Promise<void> {
  const redis = getRedis();
  await redis.eval(
    RELEASE_LOCK_SCRIPT,
    1,
    `${LOCK_PREFIX}${containerId}`,
    token,
  );
}

/**
 * Get Proxmox client and node name for a given container.
 * Returns the client, node name, and container VMID.
 */
async function getContainerContext(containerId: string) {
  const container = await DatabaseService.getContainerById(containerId);
  if (!container) {
    throw new ActionError("Container not found");
  }

  const client = await getProxmoxClient();
  return {
    client,
    nodeName: container.node.name,
    vmid: container.vmid,
    container,
  };
}

/**
 * Start a container.
 * Validates the container is currently stopped before starting.
 */
export const startContainerAction = authActionClient
  .schema(containerIdSchema)
  .action(async ({ parsedInput: { containerId } }) => {
    const token = await acquireContainerLock(containerId);
    if (!token) {
      throw new ActionError(
        "Another operation is in progress on this container. Please wait.",
      );
    }

    try {
      const { client, nodeName, vmid } = await getContainerContext(containerId);

      // Validate current state
      const status = await getContainer(client, nodeName, vmid);
      if (status.status === "running") {
        throw new ActionError("Container is already running");
      }

      // Start the container
      const upid = await startContainer(client, nodeName, vmid);
      await waitForTask(client, nodeName, upid, { timeout: 60_000 });

      // Create audit event
      await DatabaseService.createContainerEvent({
        containerId,
        type: EventType.started,
        message: `Container started (VMID ${vmid})`,
      });

      revalidatePath("/");
      revalidatePath(`/containers/${containerId}`);

      return { success: true as const };
    } finally {
      await releaseContainerLock(containerId, token);
    }
  });

/**
 * Stop a container (forceful).
 * Validates the container is currently running before stopping.
 */
export const stopContainerAction = authActionClient
  .schema(containerIdSchema)
  .action(async ({ parsedInput: { containerId } }) => {
    const token = await acquireContainerLock(containerId);
    if (!token) {
      throw new ActionError(
        "Another operation is in progress on this container. Please wait.",
      );
    }

    try {
      const { client, nodeName, vmid } = await getContainerContext(containerId);

      // Validate current state
      const status = await getContainer(client, nodeName, vmid);
      if (status.status === "stopped") {
        throw new ActionError("Container is already stopped");
      }

      // Stop the container (forceful)
      const upid = await stopContainer(client, nodeName, vmid);
      await waitForTask(client, nodeName, upid, { timeout: 60_000 });

      // Create audit event
      await DatabaseService.createContainerEvent({
        containerId,
        type: EventType.stopped,
        message: `Container stopped (VMID ${vmid})`,
      });

      revalidatePath("/");
      revalidatePath(`/containers/${containerId}`);

      return { success: true as const };
    } finally {
      await releaseContainerLock(containerId, token);
    }
  });

/**
 * Shutdown a container (graceful with force-stop fallback).
 * Attempts graceful shutdown first, then falls back to force stop
 * if the graceful shutdown times out.
 */
export const shutdownContainerAction = authActionClient
  .schema(containerIdSchema)
  .action(async ({ parsedInput: { containerId } }) => {
    const token = await acquireContainerLock(containerId);
    if (!token) {
      throw new ActionError(
        "Another operation is in progress on this container. Please wait.",
      );
    }

    try {
      const { client, nodeName, vmid } = await getContainerContext(containerId);

      // Validate current state
      const status = await getContainer(client, nodeName, vmid);
      if (status.status === "stopped") {
        throw new ActionError("Container is already stopped");
      }

      let method = "graceful";

      try {
        // Attempt graceful shutdown with 30s timeout
        const upid = await shutdownContainer(client, nodeName, vmid, 30);
        await waitForTask(client, nodeName, upid, { timeout: 45_000 });
      } catch {
        // Graceful shutdown failed or timed out — fall back to force stop
        method = "forced";
        const stopUpid = await stopContainer(client, nodeName, vmid);
        await waitForTask(client, nodeName, stopUpid, { timeout: 60_000 });
      }

      // Create audit event
      await DatabaseService.createContainerEvent({
        containerId,
        type: EventType.stopped,
        message: `Container shutdown (${method}) (VMID ${vmid})`,
      });

      revalidatePath("/");
      revalidatePath(`/containers/${containerId}`);

      return { success: true as const, method };
    } finally {
      await releaseContainerLock(containerId, token);
    }
  });

/**
 * Restart a container.
 * Stops the container (if running) then starts it.
 */
export const restartContainerAction = authActionClient
  .schema(containerIdSchema)
  .action(async ({ parsedInput: { containerId } }) => {
    const token = await acquireContainerLock(containerId);
    if (!token) {
      throw new ActionError(
        "Another operation is in progress on this container. Please wait.",
      );
    }

    try {
      const { client, nodeName, vmid } = await getContainerContext(containerId);

      // Check current state
      const status = await getContainer(client, nodeName, vmid);

      // Stop first if running
      if (status.status === "running") {
        const stopUpid = await stopContainer(client, nodeName, vmid);
        await waitForTask(client, nodeName, stopUpid, { timeout: 60_000 });
      }

      // Start the container
      const startUpid = await startContainer(client, nodeName, vmid);
      await waitForTask(client, nodeName, startUpid, { timeout: 60_000 });

      // Create audit event
      await DatabaseService.createContainerEvent({
        containerId,
        type: EventType.started,
        message: `Container restarted (VMID ${vmid})`,
      });

      revalidatePath("/");
      revalidatePath(`/containers/${containerId}`);

      return { success: true as const };
    } finally {
      await releaseContainerLock(containerId, token);
    }
  });

/**
 * Delete a container.
 * Stops the container if running, then removes from both Proxmox and database.
 */
export const deleteContainerAction = authActionClient
  .schema(containerIdSchema)
  .action(async ({ parsedInput: { containerId } }) => {
    const token = await acquireContainerLock(containerId);
    if (!token) {
      throw new ActionError(
        "Another operation is in progress on this container. Please wait.",
      );
    }

    try {
      const { client, nodeName, vmid } = await getContainerContext(containerId);

      // Stop the container first if it's running
      const status = await getContainer(client, nodeName, vmid);
      if (status.status === "running") {
        const stopUpid = await stopContainer(client, nodeName, vmid);
        await waitForTask(client, nodeName, stopUpid, { timeout: 60_000 });
      }

      // Delete from Proxmox (with purge to clean up all data)
      const deleteUpid = await deleteContainer(client, nodeName, vmid, true);
      await waitForTask(client, nodeName, deleteUpid, { timeout: 120_000 });

      // Delete from database (cascade handles services and events)
      await DatabaseService.deleteContainerById(containerId);

      revalidatePath("/");
      revalidatePath("/containers");

      return { success: true as const };
    } finally {
      await releaseContainerLock(containerId, token);
    }
  });

// ============================================================================
// Service Refresh Action
// ============================================================================

/**
 * Extract IP address from Proxmox net0 config string.
 * Format: "name=eth0,bridge=vmbr0,ip=10.0.0.5/24,..." or "ip=dhcp"
 * Returns the IP without CIDR mask, or null if not found / DHCP.
 */
function extractIpFromNet0(net0: string): string | null {
  const ipMatch = net0.match(/ip=([^,/]+)/);
  if (!ipMatch) return null;
  const ip = ipMatch[1];
  if (ip === "dhcp" || ip === "manual") return null;
  return ip;
}

/**
 * Refresh container service data by connecting via SSH and running monitoring checks.
 * Triggers the monitoring engine, then updates service records in the database.
 */
export const refreshContainerServicesAction = authActionClient
  .schema(containerIdSchema)
  .action(async ({ parsedInput: { containerId } }) => {
    // Get container with details (services for existing service names)
    const container = await DatabaseService.getContainerById(containerId);
    if (!container) {
      throw new ActionError("Container not found");
    }

    // Only allow refresh on ready containers
    if (container.lifecycle !== "ready") {
      throw new ActionError(
        "Container is not ready. Services can only be refreshed on ready containers.",
      );
    }

    // Check container is running on Proxmox
    const client = await getProxmoxClient();
    const nodeName = container.node.name;
    const vmid = container.vmid;

    let status;
    try {
      status = await getContainer(client, nodeName, vmid);
    } catch {
      throw new ActionError(
        "Unable to reach container on Proxmox. Please check the Proxmox connection.",
      );
    }

    if (status.status !== "running") {
      throw new ActionError("Container must be running to refresh services.");
    }

    // Get IP from Proxmox config
    const { getContainerConfig: getConfig } =
      await import("@/lib/proxmox/containers");
    const config = await getConfig(client, nodeName, vmid);
    const net0 = (config as Record<string, unknown>)["net0"] as
      | string
      | undefined;
    if (!net0) {
      throw new ActionError(
        "No network configuration found for container. Cannot determine IP address.",
      );
    }

    const containerIp = extractIpFromNet0(net0);
    if (!containerIp) {
      throw new ActionError(
        "Unable to determine container IP address. DHCP containers require manual IP discovery.",
      );
    }

    // Decrypt root password for SSH
    const { decrypt } = await import("@/lib/encryption");
    const rootPassword = decrypt(container.rootPassword);

    // Get existing service names for targeted checking
    const serviceNames = container.services.map((s) => s.name);

    // Run monitoring
    const { monitorContainer } = await import("@/lib/containers/monitoring");
    const result = await monitorContainer(
      containerId,
      containerIp,
      rootPassword,
      serviceNames,
    );

    if (result.error) {
      throw new ActionError(`Service refresh failed: ${result.error}`);
    }

    // Map monitoring results to service records
    const { ServiceType, ServiceStatus } = await import("@/lib/db");
    const { encrypt: encryptFn } = await import("@/lib/encryption");

    // Build service records from monitoring data
    const serviceRecords: Array<{
      name: string;
      type: "systemd" | "docker" | "process";
      port?: number;
      webUrl?: string;
      status?: "installing" | "running" | "stopped" | "error";
      credentials?: string;
    }> = [];

    // Map systemd services
    for (const svc of result.services) {
      const portInfo = result.ports.find(
        (p) => p.process === svc.name || p.process.includes(svc.name),
      );
      const creds = result.credentials.filter((c) => c.service === svc.name);

      let credentialsJson: string | undefined;
      if (creds.length > 0) {
        const credObj: Record<string, string> = {};
        for (const c of creds) {
          credObj[c.key] = c.value;
        }
        credentialsJson = encryptFn(JSON.stringify(credObj));
      }

      serviceRecords.push({
        name: svc.name,
        type: ServiceType.systemd as "systemd",
        port: portInfo?.port,
        webUrl: portInfo?.port
          ? `http://${containerIp}:${portInfo.port}`
          : undefined,
        status: svc.active
          ? (ServiceStatus.running as "running")
          : (ServiceStatus.stopped as "stopped"),
        credentials: credentialsJson,
      });
    }

    // Add ports not associated with known services as process-type services
    const knownPorts = new Set(
      serviceRecords.map((s) => s.port).filter(Boolean),
    );
    for (const port of result.ports) {
      if (!knownPorts.has(port.port)) {
        serviceRecords.push({
          name: port.process || `port-${port.port}`,
          type: ServiceType.process as "process",
          port: port.port,
          webUrl: `http://${containerIp}:${port.port}`,
          status: ServiceStatus.running as "running",
        });
      }
    }

    // Update services in database
    await DatabaseService.updateContainerServices(containerId, serviceRecords);

    revalidatePath(`/containers/${containerId}`);
    revalidatePath("/");

    return { success: true as const, serviceCount: serviceRecords.length };
  });
