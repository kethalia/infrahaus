import { createPublicClient, http } from "viem";
import { lukso } from "viem/chains";

/**
 * Server-side viem public client for LUKSO mainnet.
 *
 * Used by /api/auth/verify for SIWE message verification, including
 * EIP-1271 signature validation for Universal Profile smart contract
 * accounts. The `verifySiweMessage` method on this client automatically
 * detects smart contract signers and calls `isValidSignature`.
 *
 * Uses the default LUKSO RPC endpoint from the chain definition.
 * No "use client" — this is a server-only module used by API routes.
 */
export const luksoPublicClient = createPublicClient({
  chain: lukso,
  transport: http(),
});
