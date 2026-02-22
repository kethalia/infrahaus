/**
 * Infrastructure constants — ports, paths, prefixes, queue names.
 *
 * No "server-only" — these are plain values, safe for any context.
 * Worker and client code may import these.
 */

// ============================================================================
// Proxmox
// ============================================================================

/** Default Proxmox VE API port */
export const DEFAULT_PVE_PORT = 8006;

/** Default starting VMID when no containers exist */
export const DEFAULT_NEXT_VMID = 100;

// ============================================================================
// Redis Keys & Prefixes
// ============================================================================

/** Redis key prefix for container lifecycle locks */
export const CONTAINER_LOCK_PREFIX = "container-lock:";

/**
 * Container lock TTL in seconds. Must exceed the longest possible action
 * duration. Delete waits up to 120s stop + 120s delete = 240s, so 300s
 * provides a comfortable margin.
 */
export const CONTAINER_LOCK_TTL = 300;

/** Redis key prefix for user sessions */
export const SESSION_PREFIX = "session:";

/** Session TTL in seconds (2 hours) */
export const SESSION_TTL = 7200;

/** Session cookie name */
export const SESSION_COOKIE_NAME = "lxc-session";

// ============================================================================
// BullMQ
// ============================================================================

/** BullMQ queue name for container creation jobs */
export const CONTAINER_CREATION_QUEUE = "container-creation";

/** Max completed jobs to keep in queue history */
export const QUEUE_REMOVE_ON_COMPLETE = 100;

/** Max failed jobs to keep in queue history */
export const QUEUE_REMOVE_ON_FAIL = 500;

/** Max containers to process simultaneously */
export const WORKER_CONCURRENCY = 2;

// ============================================================================
// Filesystem Paths
// ============================================================================

/** Directory where per-service credential files are stored inside containers */
export const CREDENTIALS_DIR = "/etc/infrahaus/credentials/";

// ============================================================================
// Container Log Buffer (Redis ring buffer for progress log replay on refresh)
// ============================================================================

/**
 * Build the Redis key for a container's log ring buffer.
 * Usage: getLogBufferKey(containerId)  →  "container:{id}:logs"
 */
export const getLogBufferKey = (containerId: string) =>
  `container:${containerId}:logs`;

/** Maximum log lines retained in the ring buffer (LTRIM cap) */
export const CONTAINER_LOG_BUFFER_MAX = 2000;

/** TTL for the log buffer key — 48 hours in seconds */
export const CONTAINER_LOG_BUFFER_TTL_S = 172_800;

// ============================================================================
// VMID Cache (Redis SET per Proxmox node)
// ============================================================================

/** Redis key prefix for per-node VMID cache sets */
export const VMID_CACHE_PREFIX = "vmid-cache:";

/** VMID cache TTL in seconds (5 minutes — stale data caught at create time) */
export const VMID_CACHE_TTL_S = 300;

// ============================================================================
// SSE / Progress
// ============================================================================

/** Heartbeat interval for SSE connections (ms) */
export const SSE_HEARTBEAT_INTERVAL_MS = 15_000;

// ============================================================================
// Task Logging
// ============================================================================

/** Max log lines to fetch when a Proxmox task fails */
export const TASK_ERROR_LOG_LIMIT = 1000;
