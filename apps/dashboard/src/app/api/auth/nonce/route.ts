import { NextResponse } from "next/server";
import { generateSiweNonce } from "viem/siwe";
import { getSession } from "@/lib/session";

/**
 * GET /api/auth/nonce
 *
 * Generates a fresh SIWE nonce and stores it in the iron-session cookie.
 * The nonce is temporary — it lives in the cookie only until
 * /api/auth/verify consumes it during signature verification.
 *
 * Called by RainbowKit's auth adapter before prompting the user to sign.
 */
export async function GET() {
  try {
    const nonce = generateSiweNonce();

    // Store nonce in iron-session cookie for later verification
    const session = await getSession();
    session.nonce = nonce;
    await session.save();

    return new NextResponse(nonce, {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (error) {
    console.error("[auth] Nonce generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate nonce" },
      { status: 500 },
    );
  }
}
