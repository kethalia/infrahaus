import { NextResponse } from "next/server";
import { getSessionData } from "@/lib/session";

/**
 * GET /api/auth/me
 *
 * Returns the current session address or null.
 * This endpoint is polled by the RainbowKit auth adapter to check
 * authentication status on page load and window focus.
 */
export async function GET() {
  try {
    const sessionData = await getSessionData();

    if (!sessionData) {
      return NextResponse.json({ address: null });
    }

    return NextResponse.json({ address: sessionData.address });
  } catch (error) {
    console.error("[auth] Session check failed:", error);
    return NextResponse.json({ address: null });
  }
}
