"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { RESOURCE_POLL_INTERVAL_MS } from "@/lib/constants/timeouts";

// ============================================================================
// Types
// ============================================================================

export interface ResourceMetrics {
  /** CPU usage percentage (0-100) */
  cpu: number;
  /** Memory used (bytes) */
  mem: number;
  /** Memory total (bytes) */
  maxmem: number;
  /** Disk used (bytes) */
  disk: number;
  /** Disk total (bytes) */
  maxdisk: number;
  /** Uptime in seconds */
  uptime: number;
  /** Network received (bytes) */
  netin: number;
  /** Network sent (bytes) */
  netout: number;
  /** Container status */
  status: string;
}

interface UseResourcePollingOptions {
  /** Container VMID */
  vmid: number;
  /** Node name where container runs */
  nodeName: string;
  /** Whether polling is enabled (disable for stopped containers) */
  enabled?: boolean;
  /** Poll interval in ms (default: RESOURCE_POLL_INTERVAL_MS) */
  intervalMs?: number;
}

interface UseResourcePollingReturn {
  /** Latest resource metrics (null until first fetch) */
  metrics: ResourceMetrics | null;
  /** Whether a fetch is in progress */
  isLoading: boolean;
  /** Error message if last fetch failed */
  error: string | null;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Polls container resource metrics at a fast interval (1-2s).
 * Uses a lightweight API endpoint to fetch only status data.
 * Pauses when tab is hidden. Resumes immediately on focus.
 */
export function useResourcePolling({
  vmid,
  nodeName,
  enabled = true,
  intervalMs = RESOURCE_POLL_INTERVAL_MS,
}: UseResourcePollingOptions): UseResourcePollingReturn {
  const [metrics, setMetrics] = useState<ResourceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchMetrics = useCallback(async () => {
    // Abort any in-flight request to prevent overlap
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setIsLoading(true);
      const res = await fetch(
        `/api/containers/${encodeURIComponent(nodeName)}/${vmid}/status`,
        { signal: controller.signal },
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to fetch metrics");
    } finally {
      setIsLoading(false);
    }
  }, [vmid, nodeName]);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchMetrics();

    // Start polling interval
    intervalRef.current = setInterval(() => {
      if (document.visibilityState !== "hidden") {
        fetchMetrics();
      }
    }, intervalMs);

    // Visibility change: immediate fetch on focus
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        fetchMetrics();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (abortRef.current) abortRef.current.abort();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, intervalMs, fetchMetrics]);

  return { metrics, isLoading, error };
}
