import "server-only";

import {
  createSafeActionClient,
  DEFAULT_SERVER_ERROR_MESSAGE,
} from "next-safe-action";
import { isNetworkError } from "@/lib/utils/errors";
import { getSessionData } from "@/lib/session";

/**
 * Error class for user-facing action errors.
 * Throw this inside server actions to surface a specific message to the client
 * instead of the generic "Something went wrong" default.
 *
 * Usage: throw new ActionError("VMID 600 is already in use. Pick a different ID.");
 */
export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

/**
 * Base action client — no auth required.
 * Use for: login, public health checks.
 */
export const actionClient = createSafeActionClient({
  handleServerError(error) {
    // ActionError: intentionally user-facing, pass message through
    if (error instanceof ActionError) {
      return error.message;
    }

    if (error instanceof Error && isNetworkError(error)) {
      return "Unable to reach Proxmox server";
    }

    // Log unexpected errors server-side for debugging
    console.error("[safe-action] Unhandled server error:", error);

    return DEFAULT_SERVER_ERROR_MESSAGE;
  },
});

/**
 * Authenticated action client — verifies session is valid.
 * Use for: all protected actions (template CRUD, container ops, settings).
 *
 * Checks for a valid Redis-backed session via iron-session cookie.
 * Provides userId (Proxmox username) in ctx to all downstream actions.
 */
export const authActionClient = actionClient.use(async ({ next }) => {
  const sessionData = await getSessionData();
  if (!sessionData) {
    throw new Error("Authentication required. Please log in.");
  }

  return next({ ctx: { userId: sessionData.username } });
});
