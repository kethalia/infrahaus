"use client";

import { useQuery } from "@tanstack/react-query";
import {
  RRD_HOUR_STALE_TIME_MS,
  RRD_DAY_STALE_TIME_MS,
} from "@/lib/constants/timeouts";

// ============================================================================
// Types
// ============================================================================

export interface RrdDataPoint {
  time: number;
  cpu?: number | null;
  maxcpu?: number | null;
  mem?: number | null;
  maxmem?: number | null;
  disk?: number | null;
  maxdisk?: number | null;
  netin?: number | null;
  netout?: number | null;
}

interface UseRrdDataOptions {
  nodeName: string;
  vmid: number;
  timeframe: "hour" | "day";
  /** Only fetch when container is running */
  enabled?: boolean;
}

// ============================================================================
// Fetch function
// ============================================================================

async function fetchRrdData(
  nodeName: string,
  vmid: number,
  timeframe: "hour" | "day",
): Promise<RrdDataPoint[]> {
  const res = await fetch(
    `/api/containers/${encodeURIComponent(nodeName)}/${vmid}/rrddata?timeframe=${timeframe}`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Fetches RRD (round-robin database) historical data for a container.
 *
 * Uses TanStack Query for:
 * - Client-side caching keyed by node/vmid/timeframe
 * - Auto-refresh matching data resolution (60s for hour, 5min for day)
 * - Graceful disabling for stopped containers
 *
 * NO Redis caching — TanStack Query handles client-side freshness.
 */
export function useRrdData({
  nodeName,
  vmid,
  timeframe,
  enabled = true,
}: UseRrdDataOptions) {
  const staleTime =
    timeframe === "hour" ? RRD_HOUR_STALE_TIME_MS : RRD_DAY_STALE_TIME_MS;

  return useQuery<RrdDataPoint[]>({
    queryKey: ["rrd-data", nodeName, vmid, timeframe],
    queryFn: () => fetchRrdData(nodeName, vmid, timeframe),
    staleTime,
    gcTime: 10 * 60_000,
    refetchInterval: staleTime,
    enabled,
  });
}
