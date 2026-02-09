/**
 * Cryptographic utilities for client-side use.
 *
 * Uses the Web Crypto API (available in browsers and Node.js 18+).
 * For server-side encryption/decryption, see lib/encryption.ts instead.
 */

const PASSWORD_CHARSET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";

/**
 * Generate a cryptographically random password of a given length.
 * Uses `crypto.getRandomValues` for secure randomness.
 */
export function generatePassword(length = 16): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((byte) => PASSWORD_CHARSET[byte % PASSWORD_CHARSET.length])
    .join("");
}
