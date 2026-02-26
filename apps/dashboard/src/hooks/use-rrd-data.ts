"use client";

import { useQuery } from "@tanstack/react-query";
import {
  RRD_HOUR_STALE_TIME_MS,
  RRD_DAY_STALE_TIME_MS,
} from "@/lib/constants/timeouts";

// ============================================================================
// Types
// ============================================================================

/**
 * RRD data point shape — mirrors server-side RrdDataPointSchema but defined
 * as a TS interface (schemas.ts is server-only, not importable from client).
 */
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
 * Fetches RRD time-series data for a container via TanStack Query.
 *
 * - queryKey includes timeframe so switching fetches fresh data
 * - refetchInterval matches staleTime (60s hour, 5min day)
 * - gcTime 10 minutes keeps data available when navigating away briefly
 * - enabled prop allows callers to disable fetching for stopped containers
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
