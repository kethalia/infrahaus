// Server-side module — do not import from client components
// No "server-only" — used by worker process (runs outside Next.js via tsx)

import { SSHSession, connectWithRetry } from "@/lib/ssh";
import type { SSHExecResult } from "@/lib/ssh";

// ============================================================================
// Input Sanitization
// ============================================================================

/**
 * Validate that a string is safe for use in a shell command.
 * Allows only alphanumeric characters, hyphens, underscores, dots, and @.
 * This covers valid systemd unit names and filesystem paths without
 * shell metacharacters.
 */
const SAFE_SHELL_ARG = /^[a-zA-Z0-9._@-]+$/;

function isSafeShellArg(value: string): boolean {
  return SAFE_SHELL_ARG.test(value);
}

// ============================================================================
// Types
// ============================================================================

export interface ServiceCheckResult {
  name: string;
  active: boolean;
  enabled: boolean;
  subState: string;
}

export interface PortInfo {
  port: number;
  protocol: "tcp" | "tcp6";
  process: string;
  pid: number;
}

export interface CredentialEntry {
  service: string;
  key: string;
  value: string;
}

export interface MonitoringResult {
  services: ServiceCheckResult[];
  ports: PortInfo[];
  credentials: CredentialEntry[];
  configManagerStatus: {
    installed: boolean;
    lastRun: string | null;
    lastRunSuccess: boolean | null;
    lastLog: string | null;
  };
  error?: string;
}

// ============================================================================
// checkSystemdServices — batch-check named services via systemctl
// ============================================================================

/**
 * Check the status of specific systemd services by name.
 * Runs a combined `systemctl show` command for all services at once,
 * parsing ActiveState, SubState, and UnitFileState from the output.
 *
 * @param ssh - Active SSH session
 * @param serviceNames - List of systemd unit names (e.g., ["nginx", "ssh"])
 */
export async function checkSystemdServices(
  ssh: SSHSession,
  serviceNames: string[],
): Promise<ServiceCheckResult[]> {
  if (serviceNames.length === 0) return [];

  // Validate service names to prevent shell injection
  const safeNames = serviceNames.filter((n) => isSafeShellArg(n));
  if (safeNames.length === 0) return [];

  // Append .service if not already present
  const units = safeNames.map((n) =>
    n.endsWith(".service") ? n : `${n}.service`,
  );

  // Use systemctl show to get structured output for all units at once
  // --property limits output to just the fields we need
  const command = `systemctl show ${units.join(" ")} --property=Id,ActiveState,SubState,UnitFileState --no-pager 2>/dev/null`;

  let result: SSHExecResult;
  try {
    result = await ssh.exec(command);
  } catch {
    // SSH exec failure — return empty results rather than crashing
    return [];
  }

  const results: ServiceCheckResult[] = [];
  const output = result.stdout.trim();
  if (!output) return results;

  // systemctl show outputs blocks separated by blank lines, one per unit
  const blocks = output.split("\n\n");

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const props: Record<string, string> = {};

    for (const line of lines) {
      const eqIndex = line.indexOf("=");
      if (eqIndex !== -1) {
        const key = line.substring(0, eqIndex).trim();
        const value = line.substring(eqIndex + 1).trim();
        props[key] = value;
      }
    }

    const id = props["Id"] || "";
    const name = id.replace(/\.service$/, "");
    if (!name) continue;

    results.push({
      name,
      active: props["ActiveState"] === "active",
      enabled: props["UnitFileState"] === "enabled",
      subState: props["SubState"] || "unknown",
    });
  }

  return results;
}

// ============================================================================
// discoverPorts — find all listening TCP ports via ss
// ============================================================================

/**
 * Discover listening TCP ports on the container using `ss -tlnp`.
 * Filters out port 22 (SSH) since it's infrastructure, not application.
 *
 * @param ssh - Active SSH session
 */
export async function discoverPorts(ssh: SSHSession): Promise<PortInfo[]> {
  let result: SSHExecResult;
  try {
    result = await ssh.exec("ss -tlnp 2>/dev/null");
  } catch {
    return [];
  }

  const ports: PortInfo[] = [];
  const lines = result.stdout.trim().split("\n");

  // Skip header line (first line)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // ss -tlnp output columns:
    // State  Recv-Q  Send-Q  Local Address:Port  Peer Address:Port  Process
    // LISTEN 0       128     0.0.0.0:80          0.0.0.0:*          users:(("nginx",pid=1234,fd=6))
    const columns = line.split(/\s+/);
    if (columns.length < 5) continue;

    // Local address is typically column index 3
    const localAddr = columns[3];
    const portMatch = localAddr.match(/:(\d+)$/);
    if (!portMatch) continue;

    const port = parseInt(portMatch[1], 10);
    if (isNaN(port)) continue;

    // Filter out SSH port
    if (port === 22) continue;

    // Determine protocol from the local address
    // IPv6 addresses contain "]:" or start with "[" or the address itself contains ":"
    // ss shows tcp6 addresses like [::]:port or *:port
    const protocol: "tcp" | "tcp6" =
      localAddr.startsWith("[") || localAddr.startsWith("::") ? "tcp6" : "tcp";

    // Extract process info from the users: field
    // Format: users:(("process_name",pid=1234,fd=6))
    const processCol = columns.slice(5).join(" ");
    const processMatch = processCol.match(/\("([^"]+)",pid=(\d+)/);
    const processName = processMatch?.[1] || "unknown";
    const pid = processMatch ? parseInt(processMatch[2], 10) : 0;

    ports.push({
      port,
      protocol,
      process: processName,
      pid,
    });
  }

  // Deduplicate ports (same port may appear for both IPv4 and IPv6)
  const seen = new Set<number>();
  const deduped: PortInfo[] = [];
  for (const p of ports) {
    if (!seen.has(p.port)) {
      seen.add(p.port);
      deduped.push(p);
    }
  }

  return deduped;
}

// ============================================================================
// readCredentials — parse /etc/infrahaus/credentials files
// ============================================================================

/**
 * Read credential files from `/etc/infrahaus/credentials/`.
 * Each file represents a service. File contents are parsed as key=value pairs
 * (one per line). If a file has no `=` separator, the entire content is stored
 * as a single entry with key "password".
 *
 * @param ssh - Active SSH session
 */
export async function readCredentials(
  ssh: SSHSession,
): Promise<CredentialEntry[]> {
  let lsResult: SSHExecResult;
  try {
    lsResult = await ssh.exec(
      "ls /etc/infrahaus/credentials/ 2>/dev/null || echo '__EMPTY__'",
    );
  } catch {
    return [];
  }

  const output = lsResult.stdout.trim();
  if (!output || output === "__EMPTY__") return [];

  const files = output
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f && isSafeShellArg(f));
  const credentials: CredentialEntry[] = [];

  for (const file of files) {
    let catResult: SSHExecResult;
    try {
      catResult = await ssh.exec(
        `cat "/etc/infrahaus/credentials/${file}" 2>/dev/null`,
      );
    } catch {
      // Non-fatal: skip unreadable files
      continue;
    }

    const content = catResult.stdout.trim();
    if (!content) continue;

    // Service name from filename (strip extension)
    const service = file.replace(/\.(json|txt|conf|env)$/, "");

    // Try to parse as key=value pairs
    const lines = content.split("\n");
    let hasKeyValue = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        hasKeyValue = true;
        const key = trimmed.substring(0, eqIndex).trim();
        const value = trimmed.substring(eqIndex + 1).trim();
        credentials.push({ service, key, value });
      }
    }

    // If no key=value pairs found, store entire content as a single entry
    if (!hasKeyValue) {
      credentials.push({ service, key: "password", value: content });
    }
  }

  return credentials;
}

// ============================================================================
// checkConfigManagerStatus — check config-manager systemd unit + logs
// ============================================================================

/**
 * Check config-manager installation state, last run time, and status.
 * Looks for the systemd unit and reads the most recent log entry.
 *
 * @param ssh - Active SSH session
 */
export async function checkConfigManagerStatus(
  ssh: SSHSession,
): Promise<MonitoringResult["configManagerStatus"]> {
  const defaultStatus: MonitoringResult["configManagerStatus"] = {
    installed: false,
    lastRun: null,
    lastRunSuccess: null,
    lastLog: null,
  };

  // Check if the config-manager service unit file exists
  let unitCheck: SSHExecResult;
  try {
    unitCheck = await ssh.exec(
      "systemctl cat config-manager.service 2>/dev/null && echo '__EXISTS__' || echo '__MISSING__'",
    );
  } catch {
    return defaultStatus;
  }

  if (!unitCheck.stdout.includes("__EXISTS__")) {
    return defaultStatus;
  }

  // Service is installed — check its state
  let showResult: SSHExecResult;
  try {
    showResult = await ssh.exec(
      "systemctl show config-manager.service --property=ActiveState,SubState,ExecMainExitTimestamp,ExecMainStatus --no-pager 2>/dev/null",
    );
  } catch {
    return { ...defaultStatus, installed: true };
  }

  const props: Record<string, string> = {};
  for (const line of showResult.stdout.trim().split("\n")) {
    const eqIndex = line.indexOf("=");
    if (eqIndex !== -1) {
      props[line.substring(0, eqIndex).trim()] = line
        .substring(eqIndex + 1)
        .trim();
    }
  }

  // ExecMainExitTimestamp gives the last run time
  const lastRun = props["ExecMainExitTimestamp"] || null;
  // ExecMainStatus is the exit code (0 = success)
  const exitStatus = props["ExecMainStatus"];
  const lastRunSuccess = exitStatus !== undefined ? exitStatus === "0" : null;

  // Get the last log line from the config-manager log
  let lastLog: string | null = null;
  try {
    const logResult = await ssh.exec(
      "tail -1 /var/log/config-manager/sync.log 2>/dev/null || journalctl -u config-manager.service --no-pager -n 1 --output=short 2>/dev/null | tail -1",
    );
    const logLine = logResult.stdout.trim();
    if (logLine) {
      lastLog = logLine;
    }
  } catch {
    // Non-fatal
  }

  return {
    installed: true,
    lastRun: lastRun || null,
    lastRunSuccess,
    lastLog,
  };
}

// ============================================================================
// monitorContainer — orchestrate all monitoring checks via SSH
// ============================================================================

/**
 * Main entry point: connect via SSH and run all monitoring checks.
 * Handles SSH connection failures gracefully — returns an error string
 * in the result instead of throwing.
 *
 * @param containerId - Container ID (for logging context)
 * @param containerIp - IP address of the container
 * @param rootPassword - Root password for SSH authentication
 * @param serviceNames - Specific systemd service names to check status for
 */
export async function monitorContainer(
  containerId: string,
  containerIp: string,
  rootPassword: string,
  serviceNames: string[] = [],
): Promise<MonitoringResult> {
  let ssh: SSHSession | null = null;

  try {
    // Connect with 2 attempts (quick retry for transient failures)
    ssh = await connectWithRetry(
      {
        host: containerIp,
        username: "root",
        password: rootPassword,
      },
      { maxAttempts: 2, initialDelay: 1000 },
    );

    // Run all checks in parallel where possible
    const [services, ports, credentials, configManagerStatus] =
      await Promise.all([
        checkSystemdServices(ssh, serviceNames),
        discoverPorts(ssh),
        readCredentials(ssh),
        checkConfigManagerStatus(ssh),
      ]);

    return {
      services,
      ports,
      credentials,
      configManagerStatus,
    };
  } catch (err) {
    // SSH connection failure — return graceful error, don't throw
    const errorMessage = err instanceof Error ? err.message : String(err);

    return {
      services: [],
      ports: [],
      credentials: [],
      configManagerStatus: {
        installed: false,
        lastRun: null,
        lastRunSuccess: null,
        lastLog: null,
      },
      error: `SSH connection failed for container ${containerId} (${containerIp}): ${errorMessage}`,
    };
  } finally {
    if (ssh) {
      try {
        ssh.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}
