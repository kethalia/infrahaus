import "server-only";

import {
  getIronSession,
  type SessionOptions,
  type IronSession,
} from "iron-session";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getRedis } from "@/lib/redis";
import {
  SESSION_PREFIX,
  SESSION_COOKIE_NAME,
  MAX_SESSION_TTL_S,
  DEFAULT_SESSION_TTL_S,
} from "@/lib/constants/infrastructure";

// ============================================================================
// Session Types
// ============================================================================

/**
 * Data stored in the iron-session cookie.
 * Contains a session ID pointing to Redis data, and optionally a temporary
 * nonce used during the SIWE authentication flow.
 */
export interface SessionData {
  sessionId?: string;
  /** Temporary SIWE nonce — set during /api/auth/nonce, consumed by /api/auth/verify */
  nonce?: string;
}

/**
 * Full session data stored in Redis.
 * Contains the SIWE authentication proof for the connected Universal Profile.
 */
export interface RedisSessionData {
  /** Universal Profile address (0x...) */
  address: string;
  /** SIWE signature from the Universal Profile */
  signature: string;
  /** Raw SIWE message string that was signed */
  message: string;
  /** keccak256 hash of the SIWE message */
  messageHash: string;
  /** ISO date string — derived from SIWE expirationTime */
  expiresAt: string;
}

// ============================================================================
// Session Configuration
// ============================================================================

function getSessionOptions(): SessionOptions {
  const secret = process.env.SESSION_SECRET;

  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET environment variable is required in production. Must be at least 32 characters.",
    );
  }

  return {
    cookieName: SESSION_COOKIE_NAME,
    password: secret || "development-secret-must-be-at-least-32-chars!",
    cookieOptions: {
      httpOnly: true,
      sameSite: "strict" as const,
      secure: process.env.NODE_ENV === "production",
    },
  };
}

// ============================================================================
// Session Operations
// ============================================================================

/**
 * Get the iron-session from cookies.
 * Returns the session object with save/destroy methods.
 */
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}

/**
 * Get the full session data from Redis.
 * Reads the session ID from the iron-session cookie, then fetches
 * the actual session data from Redis.
 *
 * @returns The session data if valid and not expired, null otherwise.
 */
export async function getSessionData(): Promise<RedisSessionData | null> {
  const session = await getSession();

  if (!session.sessionId) {
    return null;
  }

  const redis = getRedis();
  const raw = await redis.get(`${SESSION_PREFIX}${session.sessionId}`);

  if (!raw) {
    // Redis session gone but cookie still exists — return null.
    // Cookie cleanup happens in middleware or logout action, not here,
    // because this function is called from RSC layouts where cookie
    // writes are forbidden (Next.js 16+).
    return null;
  }

  try {
    const data = JSON.parse(raw) as RedisSessionData;

    // Validate not expired
    const expiresAt = new Date(data.expiresAt);
    if (expiresAt <= new Date()) {
      // Session expired — clean up Redis key only.
      // Cookie cleanup happens in middleware or logout action.
      await redis.del(`${SESSION_PREFIX}${session.sessionId}`);
      return null;
    }

    return data;
  } catch {
    // Invalid JSON in Redis — clean up both Redis and cookie
    await redis.del(`${SESSION_PREFIX}${session.sessionId}`);
    session.destroy();
    return null;
  }
}

/**
 * Create a new session with SIWE authentication data.
 * Generates a random session ID, stores session data in Redis with a
 * dynamic TTL derived from the SIWE expirationTime (capped at MAX_SESSION_TTL_S),
 * and sets the session ID in the iron-session cookie.
 */
export async function createSession(data: {
  address: string;
  signature: string;
  message: string;
  messageHash: string;
  expiresAt: string;
}): Promise<void> {
  const sessionId = crypto.randomUUID();
  const redis = getRedis();

  // Store session data in Redis
  const sessionData: RedisSessionData = {
    address: data.address,
    signature: data.signature,
    message: data.message,
    messageHash: data.messageHash,
    expiresAt: data.expiresAt,
  };

  // Compute dynamic TTL from SIWE expirationTime, capped at MAX_SESSION_TTL_S
  const computedTtl = Math.floor(
    (new Date(data.expiresAt).getTime() - Date.now()) / 1000,
  );
  const ttl =
    computedTtl > 0
      ? Math.min(computedTtl, MAX_SESSION_TTL_S)
      : DEFAULT_SESSION_TTL_S;

  await redis.setex(
    `${SESSION_PREFIX}${sessionId}`,
    ttl,
    JSON.stringify(sessionData),
  );

  // Set session ID in iron-session cookie
  const session = await getSession();
  session.sessionId = sessionId;
  await session.save();
}

/**
 * Destroy the current session.
 * Removes the session data from Redis and destroys the iron-session cookie.
 */
export async function destroySession(): Promise<void> {
  const session = await getSession();

  if (session.sessionId) {
    const redis = getRedis();
    await redis.del(`${SESSION_PREFIX}${session.sessionId}`);
  }

  session.destroy();
}
