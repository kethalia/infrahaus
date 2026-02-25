"use server";

import { redirect } from "next/navigation";
import { authActionClient } from "@/lib/safe-action";
import { destroySession } from "@/lib/session";

/**
 * Logout action — destroys the session and redirects to login.
 * Uses authActionClient since the user must be authenticated to log out.
 */
export const logoutAction = authActionClient.action(async () => {
  await destroySession();
  redirect("/login");
});
