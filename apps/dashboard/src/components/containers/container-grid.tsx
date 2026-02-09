"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCw, Plus, WifiOff, Pause } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ContainerCard } from "./container-card";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import type {
  ContainerWithStatus,
  ContainerStatus,
} from "@/lib/containers/data";

type FilterStatus = "all" | ContainerStatus;

const filterOptions: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "stopped", label: "Stopped" },
  { value: "error", label: "Error" },
];

interface ContainerGridProps {
  containers: ContainerWithStatus[];
  proxmoxReachable: boolean;
}

export function ContainerGrid({
  containers,
  proxmoxReachable,
}: ContainerGridProps) {
  const [filter, setFilter] = useState<FilterStatus>("all");
  const { countdown, isPaused, refreshNow, isRefreshing } = useAutoRefresh({
    intervalSeconds: 30,
  });

  const filtered =
    filter === "all"
      ? containers
      : containers.filter((c) => c.status === filter);

  return (
    <div className="flex flex-col gap-4">
      {/* Proxmox unreachable warning */}
      {!proxmoxReachable && (
        <Alert variant="destructive">
          <WifiOff className="size-4" />
          <AlertDescription>
            Unable to reach Proxmox API. Container statuses may not be current.
            Check your Proxmox server connection.
          </AlertDescription>
        </Alert>
      )}

      {/* Toolbar: filters + refresh controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status filter pills */}
        <div className="flex items-center gap-1.5">
          {filterOptions.map((option) => (
            <Button
              key={option.value}
              variant={filter === option.value ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Refresh controls */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isPaused ? (
            <div className="flex items-center gap-1.5">
              <Pause className="size-3" />
              <span>Paused</span>
            </div>
          ) : (
            <span>Refresh in {countdown}s</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={refreshNow}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Container grid or empty state */}
      {filtered.length === 0 ? (
        <EmptyState
          hasContainers={containers.length > 0}
          activeFilter={filter}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((container) => (
            <ContainerCard key={container.id} container={container} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  hasContainers,
  activeFilter,
}: {
  hasContainers: boolean;
  activeFilter: FilterStatus;
}) {
  if (hasContainers) {
    // Have containers but none match filter
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="text-muted-foreground">
          No containers match the &quot;{activeFilter}&quot; filter.
        </p>
        <p className="text-sm text-muted-foreground">
          Try a different filter or check your containers.
        </p>
      </div>
    );
  }

  // No containers at all
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="rounded-full bg-muted p-4">
        <Plus className="size-8 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-lg font-semibold">No containers yet</h3>
        <p className="text-sm text-muted-foreground">
          Create your first container to get started.
        </p>
      </div>
      <Button asChild>
        <Link href="/containers/new">Create Container</Link>
      </Button>
    </div>
  );
}
