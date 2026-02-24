import { NextResponse, type NextRequest } from "next/server";
import { generateSiweNonce } from "viem/siwe";
import { getSession } from "@/lib/session";
import { getRedis } from "@/lib/redis";
import {
  NONCE_RATE_LIMIT_PREFIX,
  NONCE_RATE_LIMIT_MAX,
  NONCE_RATE_LIMIT_WINDOW_S,
} from "@/lib/constants/infrastructure";

/**
 * GET /api/auth/nonce
 *
 * Generates a fresh SIWE nonce and stores it in the iron-session cookie.
 * The nonce is temporary — it lives in the cookie only until
 * /api/auth/verify consumes it during signature verification.
 *
 * Rate-limited to NONCE_RATE_LIMIT_MAX requests per NONCE_RATE_LIMIT_WINDOW_S
 * per IP to prevent abuse (public endpoint, no auth required).
 *
 * Called by RainbowKit's auth adapter before prompting the user to sign.
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit by IP address
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const redis = getRedis();
    const rateLimitKey = `${NONCE_RATE_LIMIT_PREFIX}${ip}`;
    const current = await redis.incr(rateLimitKey);

    // Set expiry on first request in the window
    if (current === 1) {
      await redis.expire(rateLimitKey, NONCE_RATE_LIMIT_WINDOW_S);
    }

    if (current > NONCE_RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Too many requests. Try again later." },
        { status: 429 },
      );
    }

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
