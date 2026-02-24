/**
 * SSH Key Generation Utilities
 *
 * Generates Ed25519 key pairs in OpenSSH format using ssh-keygen CLI.
 * Used by the container creation wizard for per-container SSH key pairs.
 *
 * No "server-only" — this module uses child_process and is inherently
 * server-side only (will fail in browser context).
 */

import { execSync } from "child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import os from "os";

/**
 * Generate an Ed25519 SSH key pair using ssh-keygen.
 *
 * Returns keys in OpenSSH format:
 *   - privateKey: starts with "-----BEGIN OPENSSH PRIVATE KEY-----"
 *   - publicKey: "ssh-ed25519 AAAA... infrahaus-container"
 */
export function generateSshKeyPair(comment = "infrahaus-container"): {
  privateKey: string;
  publicKey: string;
} {
  const tmpDir = mkdtempSync(join(os.tmpdir(), "infrahaus-ssh-"));
  const keyPath = join(tmpDir, "key");

  try {
    execSync(`ssh-keygen -t ed25519 -f "${keyPath}" -N "" -C "${comment}" -q`, {
      stdio: "pipe",
    });

    const privateKey = readFileSync(keyPath, "utf-8");
    const publicKey = readFileSync(`${keyPath}.pub`, "utf-8").trim();

    return { privateKey, publicKey };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Derive the public key from an OpenSSH private key.
 *
 * Accepts a private key string (OpenSSH, PEM/PKCS8, or PuTTY format)
 * and returns the corresponding public key in OpenSSH format.
 *
 * @param privateKey - Private key content as a string
 * @returns Public key in "ssh-ed25519 AAAA..." format
 * @throws Error if the private key is invalid or ssh-keygen fails
 */
export function derivePublicKeyFromPrivate(privateKey: string): string {
  const tmpDir = mkdtempSync(join(os.tmpdir(), "infrahaus-ssh-"));
  const keyPath = join(tmpDir, "key");

  try {
    writeFileSync(keyPath, privateKey, { mode: 0o600 });
    const output = execSync(`ssh-keygen -y -f "${keyPath}"`, {
      stdio: "pipe",
    });
    return output.toString().trim();
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}
