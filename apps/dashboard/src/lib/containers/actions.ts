"use server";

/**
 * Container Creation Server Actions
 *
 * Server actions for creating containers and fetching wizard initialization data.
 * Uses authActionClient for authenticated access and next-safe-action patterns.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authActionClient, ActionError } from "@/lib/safe-action";
import { DatabaseService, prisma } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { getContainerCreationQueue } from "@/lib/queue/container-creation";
import {
  createProxmoxClientFromNode,
  createProxmoxClientFromTicket,
  storage,
  nodes as proxmoxNodes,
  templates as proxmoxTemplates,
} from "@/lib/proxmox";
import { getSessionData } from "@/lib/session";
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
// Proxmox Node Helpers (session-based fallback)
// ============================================================================

/**
 * Get or create a ProxmoxNode DB record for the env-configured PVE host.
 * When no nodes exist in the DB, auto-creates one using PVE_HOST/PVE_PORT
 * from env vars. The tokenId/tokenSecret are set to placeholders since
 * we use ticket auth from the session instead.
 *
 * Returns the node and the Proxmox node name (for API paths).
 */
async function getOrCreateSessionNode(
  sessionData: {
    ticket: string;
    csrfToken: string;
    username: string;
    expiresAt: string;
  },
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

  // If no target specified, use existing DB node (backward compat)
  if (!targetNode && existingNodes.length > 0) {
    return { nodeId: existingNodes[0].id, nodeName: existingNodes[0].name };
  }

  // Need to create a DB record for the target node (or first discovered node)
  const host = process.env.PVE_HOST;
  if (!host) {
    throw new Error(
      "No Proxmox nodes configured and PVE_HOST env var is not set.",
    );
  }
  const port = process.env.PVE_PORT ? parseInt(process.env.PVE_PORT, 10) : 8006;

  // Use target node name, or discover from API
  let nodeName = targetNode;
  if (!nodeName) {
    const client = createProxmoxClientFromTicket(
      sessionData.ticket,
      sessionData.csrfToken,
      sessionData.username,
      new Date(sessionData.expiresAt),
    );
    const clusterNodes = await proxmoxNodes.listNodes(client);
    nodeName = clusterNodes[0]?.node || "pve";
  }

  // Create a DB record with placeholder token fields (ticket auth used instead)
  const placeholderToken = encrypt("session-auth-no-token");
  const node = await DatabaseService.createNode({
    name: nodeName,
    host,
    port,
    tokenId: `${sessionData.username}!session`,
    tokenSecret: placeholderToken,
  });

  return { nodeId: node.id, nodeName: node.name };
}

/**
 * Get a Proxmox client, preferring DB node (API token) but falling back
 * to session ticket auth when the DB node has placeholder credentials.
 */
async function getProxmoxClientWithFallback(
  nodeName: string,
  sessionData: {
    ticket: string;
    csrfToken: string;
    username: string;
    expiresAt: string;
  },
) {
  // Try DB node first
  const nodes = await DatabaseService.listNodes();
  const node = nodes[0];

  // If node has a real API token (not our placeholder), use it
  if (node && !node.tokenId.endsWith("!session")) {
    return {
      client: createProxmoxClientFromNode(node),
      nodeName: node.name,
    };
  }

  // Fall back to session ticket auth
  return {
    client: createProxmoxClientFromTicket(
      sessionData.ticket,
      sessionData.csrfToken,
      sessionData.username,
      new Date(sessionData.expiresAt),
    ),
    nodeName,
  };
}

// ============================================================================
// Fetch wizard initialization data
// ============================================================================

/**
 * Fetches all data needed to initialize the container creation wizard:
 * - Templates from DB (with packages and scripts)
 * - Available storages from Proxmox
 * - Available network bridges from Proxmox
 * - Next available VMID from Proxmox
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

  // Try to get a Proxmox client — either from DB node or session credentials
  const sessionData = await getSessionData();

  // Get first configured Proxmox node
  const nodes = await DatabaseService.listNodes();
  const node = nodes[0];

  // Determine if we can connect to Proxmox at all
  const hasDbNode = !!node;
  const hasSessionCreds = !!sessionData;
  const hasEnvHost = !!process.env.PVE_HOST;

  if (!hasDbNode && (!hasSessionCreds || !hasEnvHost)) {
    return {
      templates: templates.map(mapTemplate),
      storages: [],
      bridges: [],
      nextVmid: 100,
      noNodeConfigured: true,
      osTemplates: [],
      clusterNodes: [],
    };
  }

  try {
    // Build a Proxmox client: prefer DB node with real API token, fall back to session
    let client;
    let nodeName: string;

    if (hasDbNode && !node.tokenId.endsWith("!session")) {
      // DB node with real API token
      client = createProxmoxClientFromNode(node);
      nodeName = node.name;
    } else if (hasSessionCreds && hasEnvHost) {
      // Session ticket auth fallback
      client = createProxmoxClientFromTicket(
        sessionData.ticket,
        sessionData.csrfToken,
        sessionData.username,
        new Date(sessionData.expiresAt),
      );
      // Discover node name from Proxmox API
      const clusterNodes = await proxmoxNodes.listNodes(client);
      nodeName = clusterNodes[0]?.node || node?.name || "pve";
    } else {
      // DB node exists but has placeholder token and no session — can't connect
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
    // Get session for Proxmox credentials
    const sessionData = await getSessionData();
    if (!sessionData) {
      throw new ActionError("Session expired. Please log in again.");
    }

    // Get or create a Proxmox node for the target node
    const { nodeId, nodeName } = await getOrCreateSessionNode(
      sessionData,
      data.targetNode,
    );

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

        if (
          existing &&
          (existing.lifecycle === "error" || existing.lifecycle === "creating")
        ) {
          // Delete stale record and its related events/services, then retry
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
            `VMID ${data.vmid} is already in use by an active container. Please choose a different VMID.`,
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

    // Build Proxmox credentials for the worker (ticket auth fallback)
    const host = process.env.PVE_HOST;
    const port = process.env.PVE_PORT
      ? parseInt(process.env.PVE_PORT, 10)
      : 8006;

    // Enqueue creation job
    const queue = getContainerCreationQueue();
    await queue.add("create-container", {
      containerId: container.id,
      nodeId,
      nodeName,
      templateId: data.templateId || null,
      proxmoxCredentials: host
        ? {
            host,
            port,
            ticket: sessionData.ticket,
            csrfToken: sessionData.csrfToken,
            username: sessionData.username,
            expiresAt: sessionData.expiresAt,
          }
        : undefined,
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
