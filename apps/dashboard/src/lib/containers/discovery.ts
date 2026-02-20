// No "server-only" — used by worker process (runs outside Next.js via tsx)

/**
 * Container Service Discovery
 *
 * Single module for discovering services inside running LXC containers and
 * caching results in Redis. Replaces the previous DB-backed ContainerService
 * model + monitoring.ts module.
 *
 * Usage:
 *   - Worker Phase 5 calls `discoverAndCacheServices()` after scripts finish
 *   - "Re-discover" action calls the same function on demand
 *   - UI reads via `getCachedServices()` — no DB round-trip
 *   - Container delete cleans up via `clearCachedServices()`
 */

import { encrypt, decrypt } from "@/lib/encryption";
import { CREDENTIALS_DIR } from "@/lib/constants/infrastructure";

// ============================================================================
// Types (shared across worker, actions, API routes, UI components)
// ============================================================================

export type ServiceType = "systemd" | "docker" | "process";
export type ServiceStatus = "running" | "stopped" | "installing" | "error";

/** A single discovered service */
export interface DiscoveredService {
  name: string;
  type: ServiceType;
  port: number | null;
  status: ServiceStatus;
  /** Whether this is a system/infrastructure service (vs application) */
  isSystem: boolean;
  /** Encrypted JSON blob of credentials (null if none) */
  credentials: string | null;
}

/** Full cache entry stored in Redis */
export interface ServiceCache {
  services: DiscoveredService[];
  containerIp: string | null;
  discoveredAt: string; // ISO timestamp
}

/** Service with decrypted credentials for UI consumption */
export interface ServiceWithCredentials {
  name: string;
  type: ServiceType;
  port: number | null;
  status: ServiceStatus;
  isSystem: boolean;
  credentials: Record<string, string> | null;
}

// ============================================================================
// Redis Key
// ============================================================================

/** Redis key for a container's cached service discovery data */
export const getServiceCacheKey = (containerId: string) =>
  `container:${containerId}:services`;

// ============================================================================
// Exec Adapter — abstracts SSH vs PctExec
// ============================================================================

/** Minimal interface for running commands — satisfied by SSHSession & PctExecSession */
export interface ExecAdapter {
  exec(
    command: string,
  ): Promise<{ stdout: string; stderr: string; code: number }>;
}

// ============================================================================
// System service classification
// ============================================================================

/** Known system/infrastructure services — shown in collapsed "System" section */
const SYSTEM_SERVICE_PATTERNS = new Set([
  "console-getty",
  "cron",
  "dbus",
  "networking",
  "postfix",
  "ssh",
  "sshd",
  "containerd",
  "docker",
]);

/** Prefixes that indicate system services */
const SYSTEM_SERVICE_PREFIXES = [
  "systemd-",
  "container-getty@",
  "getty@",
  "serial-getty@",
  "user@",
  "postfix@",
];

/** Classify a service name as system or application */
function isSystemService(name: string): boolean {
  if (SYSTEM_SERVICE_PATTERNS.has(name)) return true;
  return SYSTEM_SERVICE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

// ============================================================================
// Discovery Logic
// ============================================================================

/**
 * Discover all services inside a running container.
 *
 * Runs three SSH commands:
 *   1. Read per-service credential files from CREDENTIALS_DIR
 *   2. Discover listening TCP ports (PID-based matching)
 *   3. Discover running systemd units + resolve their ports via MainPID
 *
 * Returns an array of DiscoveredService (credentials are encrypted).
 */
export async function discoverServices(
  ssh: ExecAdapter,
): Promise<DiscoveredService[]> {
  // -- 1. Read per-service credential files --
  const credsByService = new Map<string, Record<string, string>>();

  const credResult = await ssh.exec(
    `ls ${CREDENTIALS_DIR} 2>/dev/null || echo '__EMPTY__'`,
  );

  if (credResult.stdout.trim() !== "__EMPTY__" && credResult.stdout.trim()) {
    const files = credResult.stdout
      .trim()
      .split("\n")
      .filter((f) => f.trim());

    for (const file of files) {
      try {
        const content = await ssh.exec(`cat "${CREDENTIALS_DIR}${file}"`);
        if (content.stdout.trim()) {
          const creds: Record<string, string> = {};
          for (const line of content.stdout.trim().split("\n")) {
            const eqIdx = line.indexOf("=");
            if (eqIdx > 0) {
              creds[line.slice(0, eqIdx).trim()] = line.slice(eqIdx + 1).trim();
            }
          }
          if (Object.keys(creds).length > 0) {
            credsByService.set(file.trim(), creds);
          }
        }
      } catch {
        // Non-fatal: skip unreadable files
      }
    }
  }

  // -- 2. Discover listening ports via PID --
  const pidToPort = new Map<string, number>();
  const portsResult = await ssh.exec("ss -tlnp 2>/dev/null | tail -n +2");

  if (portsResult.stdout.trim()) {
    for (const line of portsResult.stdout.trim().split("\n")) {
      const portMatch = line.match(/(?:0\.0\.0\.0|\*|::):(\d+)\s/);
      const pidMatch = line.match(/pid=(\d+)/);
      if (portMatch && pidMatch) {
        pidToPort.set(pidMatch[1], parseInt(portMatch[1], 10));
      }
    }
  }

  // -- 3. Discover running systemd services + resolve ports --
  const services: DiscoveredService[] = [];

  const unitsResult = await ssh.exec(
    "systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | awk '{print $1}'",
  );

  if (unitsResult.stdout.trim()) {
    const unitNames = unitsResult.stdout
      .trim()
      .split("\n")
      .filter((s) => s.trim());

    for (const unitName of unitNames) {
      const cleanName = unitName.trim().replace(/\.service$/, "");

      // Resolve port via MainPID + child PIDs (skip for known system services)
      let port: number | undefined;
      const system = isSystemService(cleanName);

      if (!system) {
        const pidResult = await ssh.exec(
          `systemctl show -p MainPID --value ${unitName.trim()} 2>/dev/null`,
        );
        const mainPid = pidResult.stdout.trim();

        if (mainPid && mainPid !== "0") {
          port = pidToPort.get(mainPid);
          if (!port) {
            // Check child processes (e.g. code-server wrapper → node child)
            const childResult = await ssh.exec(
              `pgrep -P ${mainPid} 2>/dev/null || true`,
            );
            for (const childPid of childResult.stdout.trim().split("\n")) {
              const p = childPid.trim();
              if (p && pidToPort.has(p)) {
                port = pidToPort.get(p);
                break;
              }
            }
          }
        }
      }

      // Match credentials: exact name first, then strip @instance
      const baseName = cleanName.replace(/@.*$/, "");
      const creds =
        credsByService.get(cleanName) ?? credsByService.get(baseName);
      if (creds) {
        credsByService.delete(cleanName);
        credsByService.delete(baseName);
      }

      services.push({
        name: cleanName,
        type: "systemd",
        port: port ?? null,
        status: "running",
        isSystem: system,
        credentials: creds ? encrypt(JSON.stringify(creds)) : null,
      });
    }
  }

  // -- 4. Orphaned credentials (no running unit) --
  for (const [serviceName, creds] of credsByService) {
    services.push({
      name: serviceName,
      type: "systemd",
      port: null,
      status: "stopped",
      isSystem: false,
      credentials: encrypt(JSON.stringify(creds)),
    });
  }

  return services;
}

// ============================================================================
// Redis Cache Operations
// ============================================================================

/**
 * Discover services and write results to Redis cache.
 * This is the main entry point used by both the worker and the refresh action.
 */
export async function discoverAndCacheServices(
  redis: { set: (key: string, value: string) => Promise<unknown> },
  containerId: string,
  ssh: ExecAdapter,
  containerIp: string | null,
): Promise<ServiceCache> {
  const services = await discoverServices(ssh);

  const cache: ServiceCache = {
    services,
    containerIp,
    discoveredAt: new Date().toISOString(),
  };

  await redis.set(getServiceCacheKey(containerId), JSON.stringify(cache));

  return cache;
}

/**
 * Read cached services from Redis.
 * Returns null if no cache exists (container never discovered or Redis flushed).
 */
export async function getCachedServices(
  redis: { get: (key: string) => Promise<string | null> },
  containerId: string,
): Promise<ServiceCache | null> {
  const raw = await redis.get(getServiceCacheKey(containerId));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as ServiceCache;
  } catch {
    return null;
  }
}

/**
 * Delete cached services from Redis (called on container delete).
 */
export async function clearCachedServices(
  redis: { del: (key: string) => Promise<unknown> },
  containerId: string,
): Promise<void> {
  await redis.del(getServiceCacheKey(containerId));
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Decrypt a ServiceCache into services with plaintext credentials.
 * Used by API routes and server-side data fetching.
 */
export function decryptServiceCredentials(cache: ServiceCache): {
  services: ServiceWithCredentials[];
  containerIp: string | null;
  discoveredAt: string;
} {
  const services: ServiceWithCredentials[] = cache.services.map((s) => {
    let credentials: Record<string, string> | null = null;
    if (s.credentials) {
      try {
        credentials = JSON.parse(decrypt(s.credentials));
      } catch {
        credentials = null;
      }
    }
    return {
      name: s.name,
      type: s.type,
      port: s.port,
      status: s.status,
      isSystem: s.isSystem,
      credentials,
    };
  });

  return {
    services,
    containerIp: cache.containerIp,
    discoveredAt: cache.discoveredAt,
  };
}
