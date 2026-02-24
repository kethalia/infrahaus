"use server";

/**
 * Node Management Server Actions
 *
 * CRUD operations for Proxmox node configuration. All mutations verify
 * ownership via authActionClient's session-based userId. Connection
 * testing validates Proxmox reachability before persisting credentials.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authActionClient, ActionError } from "@/lib/safe-action";
import { DatabaseService } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { ProxmoxClient } from "@/lib/proxmox/client";
import {
  createNodeSchema,
  updateNodeSchema,
  deleteNodeSchema,
  setDefaultNodeSchema,
} from "./schemas";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Test Proxmox connection using plaintext credentials.
 * Creates a temporary client and hits /version to verify reachability.
 */
async function testConnection(
  host: string,
  port: number,
  tokenId: string,
  tokenSecret: string,
): Promise<void> {
  const testClient = new ProxmoxClient({
    host,
    port,
    credentials: {
      type: "token",
      tokenId,
      tokenSecret,
    },
    verifySsl: false,
  });

  try {
    await testClient.get("/version", z.object({}).passthrough());
  } catch {
    throw new ActionError(
      `Could not connect to ${host}:${port}. Verify credentials and host reachability.`,
    );
  }
}

/**
 * Verify that a node belongs to the current user.
 * Returns the node record or throws ActionError.
 */
async function verifyOwnership(nodeId: string, userId: string) {
  const node = await DatabaseService.getNodeById(nodeId);

  if (!node || node.userId !== userId) {
    throw new ActionError("Node not found.");
  }

  return node;
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Create a new Proxmox node.
 *
 * - Tests connection to Proxmox before saving
 * - Encrypts tokenSecret before storage
 * - First node for a user automatically becomes the default
 */
export const createNodeAction = authActionClient
  .schema(createNodeSchema)
  .action(async ({ parsedInput: data, ctx }) => {
    const userId = ctx.userId;

    // 1. Test connection if API token provided
    if (data.tokenId && data.tokenSecret) {
      await testConnection(
        data.host,
        data.port,
        data.tokenId,
        data.tokenSecret,
      );
    }

    // 2. Encrypt secrets before storage
    const encryptedSecret = data.tokenSecret
      ? encrypt(data.tokenSecret)
      : undefined;

    // 3. Auto-default: first node for user becomes the default
    const existingNodes = await DatabaseService.listNodesForUser(userId);
    const isDefault = existingNodes.length === 0;

    // 4. Create the node
    const node = await DatabaseService.createNode({
      name: data.name,
      host: data.host,
      port: data.port,
      tokenId: data.tokenId,
      tokenSecret: encryptedSecret,
      isDefault,
      userId,
    });

    revalidatePath("/settings/nodes");
    return { nodeId: node.id };
  });

/**
 * Update an existing Proxmox node.
 *
 * - Verifies ownership before allowing mutation
 * - Tests connection with new credentials if tokenSecret provided
 * - Keeps existing encrypted values for fields not provided
 */
export const updateNodeAction = authActionClient
  .schema(updateNodeSchema)
  .action(async ({ parsedInput: data, ctx }) => {
    const userId = ctx.userId;

    // 1. Verify ownership
    const existingNode = await verifyOwnership(data.id, userId);

    // 2. Resolve credentials for connection test (only if tokens available)
    const resolvedTokenId = data.tokenId || existingNode.tokenId;
    const resolvedSecret = data.tokenSecret
      ? data.tokenSecret
      : existingNode.tokenSecret
        ? decrypt(existingNode.tokenSecret)
        : null;

    // 3. Test connection if we have token credentials
    if (resolvedTokenId && resolvedSecret) {
      await testConnection(
        data.host,
        data.port,
        resolvedTokenId,
        resolvedSecret,
      );
    }

    // 4. Build update data — encrypt new secrets, keep existing if not provided
    const updateData: Record<string, unknown> = {
      name: data.name,
      host: data.host,
      port: data.port,
    };

    if (data.tokenId !== undefined) {
      updateData.tokenId = data.tokenId || null;
    }

    if (data.tokenSecret) {
      updateData.tokenSecret = encrypt(data.tokenSecret);
    }

    // 5. Update the node
    await DatabaseService.updateNode(data.id, updateData);

    revalidatePath("/settings/nodes");
    return { success: true };
  });

/**
 * Delete a Proxmox node.
 *
 * - Verifies ownership before allowing deletion
 * - Prevents deletion if node has containers
 * - Promotes next node to default if deleted node was the default
 */
export const deleteNodeAction = authActionClient
  .schema(deleteNodeSchema)
  .action(async ({ parsedInput: data, ctx }) => {
    const userId = ctx.userId;

    // 1. Verify ownership
    const node = await verifyOwnership(data.id, userId);

    // 2. Delete the node (no container check — this app is not the primary
    //    way to manage containers, so node removal should always be allowed)
    await DatabaseService.deleteNode(data.id);

    // 4. If deleted node was default, promote the first remaining node
    if (node.isDefault) {
      const remainingNodes = await DatabaseService.listNodesForUser(userId);
      if (remainingNodes.length > 0) {
        await DatabaseService.setDefaultNode(userId, remainingNodes[0].id);
      }
    }

    revalidatePath("/settings/nodes");
    return { success: true };
  });

/**
 * Set a node as the default for the current user.
 *
 * - Verifies ownership before allowing mutation
 * - Uses transaction-based swap (unset all, set one)
 */
export const setDefaultNodeAction = authActionClient
  .schema(setDefaultNodeSchema)
  .action(async ({ parsedInput: data, ctx }) => {
    const userId = ctx.userId;

    // Verify ownership
    await verifyOwnership(data.id, userId);

    // Set default (transaction: unset all, set target)
    await DatabaseService.setDefaultNode(userId, data.id);

    revalidatePath("/settings/nodes");
    return { success: true };
  });

/**
 * Fetch live container counts per node from Proxmox API.
 *
 * Returns a Record<nodeId, number> map. Nodes that fail to connect
 * are returned with count -1 (error sentinel).
 */
export const getNodeContainerCountsAction = authActionClient
  .schema(z.object({}))
  .action(async ({ ctx }) => {
    const userId = ctx.userId;
    const userNodes = await DatabaseService.listNodesForUser(userId);

    // Dynamic import to avoid bundling server-only in action module scope
    const { createSessionClient } = await import("@/lib/containers/helpers");
    const { listContainers } = await import("@/lib/proxmox/containers");

    const results = await Promise.all(
      userNodes.map(async (node) => {
        try {
          const client = await createSessionClient(node);
          const containers = await listContainers(client, node.name);
          return { nodeId: node.id, count: containers.length };
        } catch {
          return { nodeId: node.id, count: -1 }; // -1 = error
        }
      }),
    );

    const counts: Record<string, number> = {};
    for (const r of results) {
      counts[r.nodeId] = r.count;
    }
    return { counts };
  });

/**
 * Test connection to an existing Proxmox node.
 *
 * - Fetches credentials from DB and decrypts
 * - Returns version info on success for user feedback
 */
export const testNodeConnectionAction = authActionClient
  .schema(z.object({ id: z.string().min(1) }))
  .action(async ({ parsedInput: data, ctx }) => {
    const userId = ctx.userId;

    // 1. Verify ownership and get node
    const node = await verifyOwnership(data.id, userId);

    // 2. Create client — use API token if available, otherwise session ticket
    let client: InstanceType<typeof ProxmoxClient>;

    if (node.tokenId && node.tokenSecret) {
      const plaintextSecret = decrypt(node.tokenSecret);
      client = new ProxmoxClient({
        host: node.host,
        port: node.port,
        credentials: {
          type: "token",
          tokenId: node.tokenId,
          tokenSecret: plaintextSecret,
        },
        verifySsl: false,
      });
    } else {
      // Fall back to session ticket
      const { createSessionClient } = await import("@/lib/containers/helpers");
      client = await createSessionClient(node);
    }

    try {
      const result = await client.get(
        "/version",
        z.object({ version: z.string() }).passthrough(),
      );
      return { success: true, version: result.version };
    } catch {
      throw new ActionError(
        `Could not connect to ${node.host}:${node.port}. Verify credentials and host reachability.`,
      );
    }
  });
