import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual, createHash } from "crypto";
import { parseSiweMessage } from "viem/siwe";
import { keccak256, toHex } from "viem";
import { luksoPublicClient } from "@/lib/web3/client";
import { getSession, createSession } from "@/lib/session";

/**
 * Expected LUKSO chain ID.
 * Only SIWE messages signed on LUKSO mainnet are accepted.
 */
const EXPECTED_CHAIN_ID = 42;

/**
 * POST /api/auth/verify
 *
 * Validates a SIWE signature (including EIP-1271 for Universal Profile
 * smart contract accounts via viem's built-in ERC-6492 verifier),
 * verifies the nonce matches the one stored in the iron-session cookie,
 * validates domain/URI/chainId/expiration, and creates a Redis-backed session.
 *
 * viem's verifySiweMessage flow:
 *   1. verifySiweMessage → verifyHash → verifyErc6492
 *   2. ERC-6492 verifier detects UP has code (smart contract)
 *   3. Calls isValidSignature(bytes32, bytes) on the UP contract (EIP-1271)
 *   4. UP delegates to LSP6 KeyManager for permission checking
 *   5. Returns magic value 0x1626ba7e if valid
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

    // --- Validate domain matches the request origin ---
    const expectedDomain =
      request.headers.get("host") ??
      process.env.NEXT_PUBLIC_APP_DOMAIN ??
      "localhost:3001";

    if (siweMessage.domain !== expectedDomain) {
      return NextResponse.json(
        { ok: false, error: "Invalid domain" },
        { status: 422 },
      );
    }

    // --- Validate URI matches the request origin ---
    const expectedUri =
      process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const normalizeUrl = (url: string) => url.replace(/\/+$/, "");

    if (
      siweMessage.uri &&
      normalizeUrl(siweMessage.uri) !== normalizeUrl(expectedUri)
    ) {
      return NextResponse.json(
        { ok: false, error: "Invalid URI" },
        { status: 422 },
      );
    }

    // --- Validate chain ID is LUKSO mainnet ---
    if (siweMessage.chainId !== EXPECTED_CHAIN_ID) {
      return NextResponse.json(
        { ok: false, error: "Invalid chain" },
        { status: 422 },
      );
    }

    // --- Reject already-expired messages ---
    if (
      siweMessage.expirationTime &&
      siweMessage.expirationTime <= new Date()
    ) {
      return NextResponse.json(
        { ok: false, error: "Message expired" },
        { status: 422 },
      );
    }

    // --- Verify nonce matches the one stored in the iron-session cookie ---
    // Hash both nonces to fixed-length SHA-256 digests before comparing.
    // This avoids leaking length information through the comparison — a plain
    // length check before timingSafeEqual would reveal whether lengths differ
    // via timing differences.
    const session = await getSession();
    const hashNonce = (v: string) => createHash("sha256").update(v).digest();
    const messageNonceHash = hashNonce(siweMessage.nonce ?? "");
    const sessionNonceHash = hashNonce(session.nonce ?? "");
    if (!timingSafeEqual(messageNonceHash, sessionNonceHash)) {
      return NextResponse.json(
        { ok: false, error: "Invalid nonce" },
        { status: 422 },
      );
    }

    // --- Verify SIWE signature ---
    // For Universal Profiles (smart contracts), viem automatically uses
    // ERC-6492 → EIP-1271 isValidSignature() on the UP contract.
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

    // --- Clear nonce to prevent replay within the same browser session ---
    session.nonce = undefined;
    await session.save();

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
