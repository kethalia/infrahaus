/**
 * Shared formatting and parsing utilities.
 *
 * All generic display formatters belong here. Domain-specific formatting
 * should stay in its domain module (e.g., proxmox config formatting).
 */

/**
 * Format a memory value in MB to a human-readable string.
 * Returns "GB" for values >= 1024 MB.
 */
export function formatMemory(mb: number | null, showBoth = false): string {
  if (mb === null) return "—";
  if (mb >= 1024) {
    const gb = (mb / 1024).toFixed(1);
    return showBoth ? `${gb} GB (${mb} MB)` : `${gb} GB`;
  }
  return `${mb} MB`;
}

/**
 * Format a byte count to a human-readable string (B/KB/MB/GB/TB).
 * Uses binary units (1 KB = 1024 bytes).
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
}

/**
 * Format a duration in seconds to a human-readable string (e.g., "3d 2h 15m").
 * Returns "N/A" for 0 seconds, "< 1m" for very short durations.
 */
export function formatUptime(seconds: number): string {
  if (seconds === 0) return "N/A";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.length > 0 ? parts.join(" ") : "< 1m";
}

/**
 * Format a Date to a relative time string ("just now", "5m ago", "3d ago").
 * Falls back to `toLocaleDateString()` for dates older than 30 days.
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

/**
 * Parse semicolon-separated tags string into an array.
 * Handles null/undefined, trims whitespace, filters empty strings.
 */
export function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return tags
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);
}
