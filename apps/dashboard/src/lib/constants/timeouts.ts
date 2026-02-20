/**
 * Timeout, interval, and retry constants.
 *
 * Centralizes all timing-related magic numbers. When tuning timeouts
 * or poll intervals, update here rather than hunting across files.
 *
 * No "server-only" — these are plain values, safe for any context.
 */

// ============================================================================
// Proxmox Task Polling
// ============================================================================

/** Default interval between task status polls (ms) */
export const TASK_POLL_INTERVAL_MS = 2_000;

/** Default task timeout — standard operations like start/stop (ms) */
export const TASK_TIMEOUT_MS = 60_000;

/** Extended task timeout — long operations like container creation (ms) */
export const TASK_TIMEOUT_LONG_MS = 120_000;

/** Default task timeout for waitForTask — fallback if not specified (ms) */
export const TASK_TIMEOUT_DEFAULT_MS = 300_000;

/** Graceful shutdown timeout sent to Proxmox (seconds) */
export const SHUTDOWN_TIMEOUT_S = 30;

/** Timeout to wait for graceful shutdown before falling back to force-stop (ms) */
export const SHUTDOWN_WAIT_MS = 45_000;

/** Delete task timeout — deleting a container (ms) */
export const DELETE_TIMEOUT_MS = 120_000;

// ============================================================================
// Proxmox Client
// ============================================================================

/** Per-request timeout for Proxmox API calls (ms) — prevents indefinite hangs
 *  when Proxmox tries to proxy to an unreachable cluster node (HTTP 596). */
export const PVE_REQUEST_TIMEOUT_MS = 30_000;

/** Ticket refresh threshold — refresh when less than this remains (ms) */
export const TICKET_REFRESH_THRESHOLD_MS = 10 * 60 * 1000;

/** Ticket cache buffer — consider ticket stale if within this of expiry (ms) */
export const TICKET_CACHE_BUFFER_MS = 5 * 60 * 1000;

// ============================================================================
// Auto-Refresh (UI)
// ============================================================================

/** Default auto-refresh interval for dashboard/detail pages (seconds) */
export const AUTO_REFRESH_INTERVAL_S = 30;

/** Duration to show "refreshing" animation before resetting countdown (ms) */
export const REFRESH_ANIMATION_MS = 500;

// ============================================================================
// Container Provisioning
// ============================================================================

/** Max attempts to check if container filesystem is ready after start */
export const CONTAINER_FILESYSTEM_READY_MAX_ATTEMPTS = 15;

/** Delay between container filesystem ready checks (ms) */
export const CONTAINER_FILESYSTEM_CHECK_DELAY_MS = 1000;

// ============================================================================
// Redis
// ============================================================================

/** Redis retry delay multiplier (ms per attempt) */
export const REDIS_RETRY_DELAY_MULTIPLIER_MS = 50;
