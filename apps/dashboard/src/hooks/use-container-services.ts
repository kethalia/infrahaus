"use client";

import { useQuery } from "@tanstack/react-query";
import type { CachedServiceInfo, ContainerStatus } from "@/lib/containers/data";

// ============================================================================
// Types
// ============================================================================

interface ServiceResponse {
  services: CachedServiceInfo[];
  containerIp: string | null;
  discoveredAt: string | null;
}

interface UseContainerServicesOptions {
  /** Node name (e.g. "pve-03") */
  nodeName: string;
  /** Container VMID */
  vmid: number;
  /** Container status — discovery only triggers for running containers */
  status: ContainerStatus;
  /**
   * Whether to trigger discovery if cache is empty.
   * Default: true. Set false to only read cache (e.g. stopped containers).
   */
  discover?: boolean;
}

// ============================================================================
// Fetch function
// ============================================================================

async function fetchServices(
  nodeName: string,
  vmid: number,
  discover: boolean,
): Promise<ServiceResponse> {
  const params = discover ? "?discover=true" : "";
  const res = await fetch(
    `/api/containers/${encodeURIComponent(nodeName)}/${vmid}/services${params}`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Fetches container services from Redis cache. If cache is empty and
 * container is running, triggers SSH-based discovery automatically.
 *
 * Uses TanStack Query for:
 * - Deduplication (multiple cards for same container won't fire parallel requests)
 * - Loading/error states
 * - Stale-while-revalidate (staleTime matches Redis 24h TTL)
 * - Manual invalidation via queryClient.invalidateQueries
 */
export function useContainerServices({
  nodeName,
  vmid,
  status,
  discover = true,
}: UseContainerServicesOptions) {
  const isRunning = status === "running";
  const shouldDiscover = discover && isRunning;

  return useQuery<ServiceResponse>({
    queryKey: ["container-services", nodeName, vmid],
    queryFn: () => fetchServices(nodeName, vmid, shouldDiscover),
    // Cache for 5 minutes client-side (Redis has 24h TTL server-side)
    staleTime: 5 * 60 * 1000,
    // Keep data for 10 minutes after component unmounts
    gcTime: 10 * 60 * 1000,
    // Only enabled for running or stopped containers (not creating/error)
    enabled: status !== "creating",
    // Don't retry on discovery — SSH failures are expected for some containers
    retry: shouldDiscover ? 0 : 1,
  });
}
