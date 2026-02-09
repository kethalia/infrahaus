/**
 * Display constants — shared UI configuration values.
 *
 * Contains status color maps, UI thresholds, and display limits
 * used across multiple components. Icon maps that reference React
 * components stay co-located with their consuming component.
 *
 * No "server-only" — these are used by client components.
 */

import type { ContainerStatus } from "@/lib/containers/data";

// ============================================================================
// Status Colors & Labels
// ============================================================================

/** Container status → badge color/label mapping. Used by StatusBadge and any component showing container status. */
export const containerStatusConfig: Record<
  ContainerStatus,
  { label: string; className: string; dotColor: string }
> = {
  running: {
    label: "Running",
    className:
      "bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-400",
    dotColor: "bg-emerald-500",
  },
  stopped: {
    label: "Stopped",
    className:
      "bg-gray-500/15 text-gray-700 border-gray-500/25 dark:text-gray-400",
    dotColor: "bg-gray-500",
  },
  creating: {
    label: "Creating",
    className:
      "bg-blue-500/15 text-blue-700 border-blue-500/25 dark:text-blue-400",
    dotColor: "bg-blue-500 animate-pulse",
  },
  error: {
    label: "Error",
    className: "bg-red-500/15 text-red-700 border-red-500/25 dark:text-red-400",
    dotColor: "bg-red-500",
  },
  unknown: {
    label: "Unknown",
    className:
      "bg-yellow-500/15 text-yellow-700 border-yellow-500/25 dark:text-yellow-400",
    dotColor: "bg-yellow-500",
  },
};

/** Service status → badge color/label mapping. Used by ServicesTab. */
export const serviceStatusConfig: Record<
  string,
  { label: string; className: string }
> = {
  running: {
    label: "Running",
    className:
      "bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-400",
  },
  stopped: {
    label: "Stopped",
    className:
      "bg-gray-500/15 text-gray-700 border-gray-500/25 dark:text-gray-400",
  },
  installing: {
    label: "Installing",
    className:
      "bg-blue-500/15 text-blue-700 border-blue-500/25 dark:text-blue-400",
  },
  error: {
    label: "Error",
    className: "bg-red-500/15 text-red-700 border-red-500/25 dark:text-red-400",
  },
};

// ============================================================================
// UI Thresholds & Limits
// ============================================================================

/** Max services/events to show in preview cards (dashboard container card) */
export const MAX_PREVIEW_ITEMS = 3;

/** Resource bar warning threshold (percentage) — shows yellow/warning color */
export const RESOURCE_WARNING_THRESHOLD = 70;

/** Resource bar critical threshold (percentage) — shows red/destructive color */
export const RESOURCE_CRITICAL_THRESHOLD = 90;
