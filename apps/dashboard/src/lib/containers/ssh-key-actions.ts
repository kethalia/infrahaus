"use server";

/**
 * SSH Key Server Actions
 *
 * Server actions for generating SSH key pairs and deriving public keys
 * from private keys. Used by the container creation wizard.
 */

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";
import {
  generateSshKeyPair,
  derivePublicKeyFromPrivate,
} from "@/lib/utils/ssh-keys";

/**
 * Generate a new Ed25519 SSH key pair.
 * Returns both private and public keys in OpenSSH format.
 */
export const generateSshKeyPairAction = authActionClient
  .schema(z.object({}))
  .action(async () => {
    const { privateKey, publicKey } = generateSshKeyPair();
    return { privateKey, publicKey };
  });

/**
 * Derive the public key from a private key.
 * Used when the user pastes their own private key.
 */
export const deriveSshPublicKeyAction = authActionClient
  .schema(z.object({ privateKey: z.string().min(1) }))
  .action(async ({ parsedInput: { privateKey } }) => {
    try {
      const publicKey = derivePublicKeyFromPrivate(privateKey);
      return { publicKey };
    } catch {
      return { error: "Invalid private key format" };
    }
  });
