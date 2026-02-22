"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { actionClient, authActionClient, ActionError } from "@/lib/safe-action";
import { login } from "@/lib/proxmox/auth";
import { createSession, destroySession } from "@/lib/session";
import { DatabaseService } from "@/lib/db";
import { encrypt } from "@/lib/encryption";
import { ProxmoxClient } from "@/lib/proxmox/client";
import { listNodes } from "@/lib/proxmox/nodes";

// ============================================================================
// Schemas
// ============================================================================

const loginSchema = z.object({
  host: z.string().min(1, "Proxmox host is required"),
  port: z.coerce.number().int().min(1).max(65535).default(8006),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  realm: z.enum(["pam", "pve"]).default("pam"),
});

// ============================================================================
// Actions
// ============================================================================

/**
 * Login action — authenticates against Proxmox VE, creates a session,
 * and auto-provisions the Proxmox node in the database if not already present.
 *
 * On first login, the node is created with:
 * - name: resolved from Proxmox cluster API
 * - host/port: from login form
 * - sshPassword: the login password (encrypted) — for pct exec service discovery
 * - No API token (optional, can be added later in Settings for background jobs)
 */
export const loginAction = actionClient
  .schema(loginSchema)
  .action(
    async ({ parsedInput: { host, port, username, password, realm } }) => {
      try {
        const credentials = await login(host, port, username, password, realm);
        const userId = credentials.username; // e.g. "root@pam"

        await createSession({
          ticket: credentials.ticket,
          csrfToken: credentials.csrfToken,
          username: userId,
          realm,
          expiresAt: credentials.expiresAt.toISOString(),
          host,
          port,
        });

        // Auto-provision node if not already in DB
        await ensureNodeExists({
          host,
          port,
          userId,
          password,
          ticket: credentials.ticket,
          csrfToken: credentials.csrfToken,
        });

        return { success: true as const };
      } catch (error) {
        console.error("[auth] Login failed:", error);
        throw new ActionError(
          "Invalid credentials or Proxmox host unreachable",
        );
      }
    },
  );

/**
 * Logout action — destroys the session and redirects to login.
 * Uses authActionClient since the user must be authenticated to log out.
 */
export const logoutAction = authActionClient.action(async () => {
  await destroySession();
  redirect("/login");
});

// ============================================================================
// Helpers
// ============================================================================

/**
 * Ensure a Proxmox node record exists in the DB for this host/user.
 * If not, creates one by querying the Proxmox API for the node name.
 *
 * This runs on every login but is a no-op if the node already exists.
 * Also updates the SSH password if it wasn't set before.
 */
async function ensureNodeExists(params: {
  host: string;
  port: number;
  userId: string;
  password: string;
  ticket: string;
  csrfToken: string;
}): Promise<void> {
  const { host, port, userId, password, ticket, csrfToken } = params;

  try {
    // Check if a node already exists for this host + user
    const existingNodes = await DatabaseService.listNodesForUser(userId);
    const existingNode = existingNodes.find(
      (n) => n.host === host && n.port === port,
    );

    if (existingNode) {
      // Node exists — ensure SSH password is set (may have been missing before)
      if (!existingNode.sshPassword) {
        await DatabaseService.updateNode(existingNode.id, {
          sshPassword: encrypt(password),
        });
      }
      return;
    }

    // Node doesn't exist — resolve node name from Proxmox API
    const client = new ProxmoxClient({
      host,
      port,
      credentials: {
        type: "ticket",
        ticket,
        csrfToken,
        username: userId,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
      verifySsl: false,
    });

    let nodeName = host; // fallback
    try {
      const clusterNodes = await listNodes(client);
      // Find the node that matches this host, or just pick the first online one
      const onlineNode = clusterNodes.find((n) => n.status === "online");
      if (onlineNode) {
        nodeName = onlineNode.node;
      }
    } catch {
      // Non-fatal — use host as name fallback
    }

    // Check for name collision (different host, same name)
    const nameExists = existingNodes.find((n) => n.name === nodeName);
    if (nameExists) {
      // Append host to disambiguate
      nodeName = `${nodeName}-${host}`;
    }

    // Create the node
    const isFirst = existingNodes.length === 0;
    await DatabaseService.createNode({
      name: nodeName,
      host,
      port,
      sshPassword: encrypt(password),
      isDefault: isFirst,
      userId,
    });
  } catch (error) {
    // Non-fatal — login succeeds even if node provisioning fails
    console.error("[auth] Auto-provision node failed:", error);
  }
}
