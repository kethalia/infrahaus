import { NextResponse, type NextRequest } from "next/server";
import { parseSiweMessage } from "viem/siwe";
import { keccak256, toHex } from "viem";
import { luksoPublicClient } from "@/lib/web3/client";
import { getSession, createSession } from "@/lib/session";

/**
 * POST /api/auth/verify
 *
 * Validates a SIWE signature (including EIP-1271 for Universal Profile
 * smart contract accounts), verifies the nonce matches the one stored
 * in the iron-session cookie, and creates a Redis-backed session.
 *
 * Request body: { message: string, signature: string }
 *
 * Called by RainbowKit's auth adapter after the user signs the SIWE message.
 */
export async function POST(request: NextRequest) {
  try {
    const { message, signature } = await request.json();

    if (!message || !signature) {
      return NextResponse.json(
        { ok: false, error: "Missing message or signature" },
        { status: 400 },
      );
    }

    // Parse the SIWE message to extract fields
    const siweMessage = parseSiweMessage(message);

    // Verify nonce matches the one stored in the iron-session cookie
    const session = await getSession();
    if (siweMessage.nonce !== session.nonce) {
      return NextResponse.json(
        { ok: false, error: "Invalid nonce" },
        { status: 422 },
      );
    }

    // Verify SIWE signature — handles EIP-1271 for UP smart contracts automatically
    const isValid = await luksoPublicClient.verifySiweMessage({
      message,
      signature,
    });

    if (!isValid) {
      return NextResponse.json(
        { ok: false, error: "Invalid signature" },
        { status: 401 },
      );
    }

    // Compute message hash for session storage
    const messageHash = keccak256(toHex(message));

    // Compute expiresAt from SIWE expirationTime, default to 2 hours
    const expiresAt = siweMessage.expirationTime
      ? siweMessage.expirationTime.toISOString()
      : new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    // Create the Redis-backed session
    await createSession({
      address: siweMessage.address!,
      signature,
      message,
      messageHash,
      expiresAt,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth] SIWE verification failed:", error);
    return NextResponse.json(
      { ok: false, error: "Verification failed" },
      { status: 500 },
    );
  }
}
