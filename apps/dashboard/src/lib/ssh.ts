// No "server-only" — used by worker process (runs outside Next.js via tsx)

import { Client as SSHClient } from "ssh2";

// ============================================================================
// Types
// ============================================================================

export interface SSHConfig {
  host: string;
  port?: number; // default 22
  username: string;
  password: string;
  readyTimeout?: number; // default 10000
  keepaliveInterval?: number; // default 15000ms
  keepaliveCountMax?: number; // default 3
}

export interface SSHExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Returns true for SSH connection errors that warrant a reconnect attempt.
 * Covers channel-open failures (server rejects a new channel on a stale
 * connection) and socket-level errors (TCP connection silently dropped).
 */
function isReconnectableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("channel open failure") ||
    msg.includes("channel open failed") ||
    msg.includes("socket is closed") ||
    msg.includes("not connected") ||
    msg.includes("connection reset") ||
    msg.includes("broken pipe")
  );
}

// ============================================================================
// SSHSession — connection-reuse pattern
// ============================================================================

/**
 * Wraps an ssh2 Client with connection reuse.
 * Provides exec, streaming exec, and SFTP file upload.
 *
 * Usage:
 *   const ssh = new SSHSession({ host, username, password });
 *   const result = await ssh.exec("whoami");
 *   await ssh.uploadFile(scriptContent, "/tmp/setup.sh", 0o755);
 *   ssh.close();
 */
export class SSHSession {
  private conn: SSHClient;
  private ready: Promise<void>;
  readonly config: SSHConfig;

  constructor(config: SSHConfig) {
    this.config = config;
    this.conn = new SSHClient();
    this.ready = new Promise<void>((resolve, reject) => {
      this.conn
        .on("ready", resolve)
        .on("error", reject)
        .connect({
          host: config.host,
          port: config.port ?? 22,
          username: config.username,
          password: config.password,
          readyTimeout: config.readyTimeout ?? 10000,
          // Keepalive prevents silent session drops during long-running scripts
          // (e.g. Docker install restarts networking and can drop the SSH session)
          keepaliveInterval: config.keepaliveInterval ?? 15_000,
          keepaliveCountMax: config.keepaliveCountMax ?? 3,
        });
    });
  }

  /**
   * Execute a command and collect stdout/stderr as strings.
   */
  async exec(command: string): Promise<SSHExecResult> {
    await this.ready;
    return new Promise((resolve, reject) => {
      this.conn.exec(command, (err, stream) => {
        if (err) return reject(err);

        let stdout = "";
        let stderr = "";

        stream
          .on("close", (code: number) => {
            resolve({ stdout, stderr, code });
          })
          .on("data", (data: Buffer) => {
            stdout += data.toString();
          })
          .stderr.on("data", (data: Buffer) => {
            stderr += data.toString();
          });
      });
    });
  }

  /**
   * Execute a command and stream stdout/stderr line-by-line via callback.
   * Returns the exit code.
   */
  async execStreaming(
    command: string,
    onOutput: (line: string, isStderr: boolean) => void,
  ): Promise<number> {
    await this.ready;
    return new Promise((resolve, reject) => {
      this.conn.exec(command, (err, stream) => {
        if (err) return reject(err);

        stream
          .on("close", (code: number) => {
            resolve(code);
          })
          .on("data", (data: Buffer) => {
            data
              .toString()
              .split("\n")
              .filter(Boolean)
              .forEach((line) => onOutput(line, false));
          })
          .stderr.on("data", (data: Buffer) => {
            data
              .toString()
              .split("\n")
              .filter(Boolean)
              .forEach((line) => onOutput(line, true));
          });
      });
    });
  }

  /**
   * Upload a file via SFTP.
   */
  async uploadFile(
    content: string | Buffer,
    remotePath: string,
    mode?: number,
  ): Promise<void> {
    await this.ready;
    return new Promise((resolve, reject) => {
      this.conn.sftp((err, sftp) => {
        if (err) return reject(err);

        const writeStream = sftp.createWriteStream(remotePath, {
          mode: mode ?? 0o644,
        });

        writeStream.on("close", () => {
          resolve();
        });

        writeStream.on("error", (writeErr: Error) => {
          reject(writeErr);
        });

        writeStream.end(content);
      });
    });
  }

  /**
   * Close the SSH connection.
   */
  close(): void {
    this.conn.end();
  }
}

// ============================================================================
// PctExecSession — routes commands through Proxmox host via pct exec/push
// ============================================================================

/**
 * Wraps an SSHSession connected to a Proxmox host node and routes all
 * commands through `pct exec` and file uploads through `pct push`.
 *
 * This avoids needing SSH configured inside the LXC container — commands
 * run directly via the Proxmox container runtime.
 *
 * Implements the same interface as SSHSession so it can be used as a
 * drop-in replacement in the worker pipeline.
 */
export class PctExecSession {
  private hostSession: SSHSession;
  private vmid: number;

  constructor(hostSession: SSHSession, vmid: number) {
    this.hostSession = hostSession;
    this.vmid = vmid;
  }

  /**
   * Reconnect the underlying host SSH session.
   * Called automatically when a reconnectable error is detected —
   * this happens when a long-running script (e.g. Docker install) causes
   * a brief network disruption that silently drops the SSH session.
   */
  private async reconnect(): Promise<void> {
    try {
      this.hostSession.close();
    } catch {
      // Ignore — connection may already be dead
    }
    this.hostSession = new SSHSession(this.hostSession.config);
    // Verify the new connection is up before returning
    await this.hostSession.exec("echo ok");
  }

  /**
   * Run fn(), and if it throws a reconnectable SSH error, reconnect once and retry.
   * Centralises the try/reconnect/retry pattern for exec, execStreaming, and uploadFile.
   */
  private async withReconnect<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (isReconnectableError(err)) {
        await this.reconnect();
        return fn();
      }
      throw err;
    }
  }

  /**
   * Execute a command inside the container via `pct exec`.
   * Retries once with a fresh SSH connection on reconnectable SSH errors.
   */
  async exec(command: string): Promise<SSHExecResult> {
    const escaped = command.replace(/'/g, "'\\''");
    const pctCmd = `pct exec ${this.vmid} -- bash -c '${escaped}'`;
    return this.withReconnect(() => this.hostSession.exec(pctCmd));
  }

  /**
   * Execute a command inside the container with streaming output via `pct exec`.
   * Retries once with a fresh SSH connection on reconnectable SSH errors.
   */
  async execStreaming(
    command: string,
    onOutput: (line: string, isStderr: boolean) => void,
  ): Promise<number> {
    const escaped = command.replace(/'/g, "'\\''");
    const pctCmd = `pct exec ${this.vmid} -- bash -c '${escaped}'`;
    return this.withReconnect(() =>
      this.hostSession.execStreaming(pctCmd, onOutput),
    );
  }

  /**
   * Upload a file into the container via `pct push`.
   * Writes to a temp file on the host, then pushes into the container.
   * Retries once with a fresh SSH connection on reconnectable SSH errors.
   * Throws if pct push fails (e.g., target directory doesn't exist in container).
   */
  async uploadFile(
    content: string | Buffer,
    remotePath: string,
    mode?: number,
  ): Promise<void> {
    const tmpPath = `/tmp/.pct-upload-${this.vmid}-${Date.now()}`;
    const permsArg = mode ? ` --perms 0${mode.toString(8)}` : "";

    const doUpload = async () => {
      // Write content to a temp file on the Proxmox host
      await this.hostSession.uploadFile(content, tmpPath, 0o644);

      try {
        // Push from host into container
        const result = await this.hostSession.exec(
          `pct push ${this.vmid} ${tmpPath} ${remotePath}${permsArg}`,
        );

        if (result.code !== 0) {
          const errMsg = (result.stderr || result.stdout).trim();
          throw new Error(
            `pct push failed for ${remotePath} (exit code ${result.code}): ${errMsg}`,
          );
        }
      } finally {
        // Clean up temp file on host regardless of success/failure
        await this.hostSession.exec(`rm -f ${tmpPath}`);
      }
    };

    return this.withReconnect(doUpload);
  }

  /**
   * Close the underlying host SSH connection.
   */
  close(): void {
    this.hostSession.close();
  }
}

// ============================================================================
// connectWithRetry — exponential backoff for new containers
// ============================================================================

/**
 * Connect to SSH with retry and exponential backoff.
 * Useful for newly created containers where SSH takes seconds to start.
 *
 * Default: 5 attempts, 2000ms initial delay (2s → 4s → 8s → 16s → 32s).
 */
export async function connectWithRetry(
  config: SSHConfig,
  options?: { maxAttempts?: number; initialDelay?: number },
): Promise<SSHSession> {
  const maxAttempts = options?.maxAttempts ?? 5;
  const initialDelay = options?.initialDelay ?? 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let session: SSHSession | null = null;
    try {
      session = new SSHSession(config);
      // Wait for the ready promise to confirm connection
      await session.exec("echo ok");
      return session;
    } catch (err) {
      // Close the failed session to avoid leaking sockets
      if (session) {
        try {
          session.close();
        } catch {
          // Ignore close errors on failed session
        }
      }

      if (attempt === maxAttempts) {
        throw new Error(
          `SSH connection failed after ${maxAttempts} attempts: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      const delay = initialDelay * Math.pow(2, attempt - 1);
      console.log(
        `SSH connection attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Unreachable, but satisfies TypeScript
  throw new Error("SSH connection failed");
}
