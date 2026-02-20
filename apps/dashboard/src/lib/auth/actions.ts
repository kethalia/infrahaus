"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { actionClient, authActionClient, ActionError } from "@/lib/safe-action";
import { login } from "@/lib/proxmox/auth";
import { createSession, destroySession } from "@/lib/session";

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
 * Login action — authenticates against Proxmox VE and creates a session.
 * Uses actionClient (unauthenticated) since the user isn't logged in yet.
 */
export const loginAction = actionClient
  .schema(loginSchema)
  .action(
    async ({ parsedInput: { host, port, username, password, realm } }) => {
      try {
        const credentials = await login(host, port, username, password, realm);

        await createSession({
          ticket: credentials.ticket,
          csrfToken: credentials.csrfToken,
          username: credentials.username,
          realm,
          expiresAt: credentials.expiresAt.toISOString(),
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
