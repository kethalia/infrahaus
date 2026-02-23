import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

/**
 * POST /api/auth/logout
 *
 * Destroys the Redis session and iron-session cookie.
 *
 * Called by RainbowKit's auth adapter signOut callback AND by the
 * sidebar logoutAction (which uses the server action pattern).
 */
export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth] Logout failed:", error);
    return NextResponse.json(
      { ok: false, error: "Logout failed" },
      { status: 500 },
    );
  }
}
