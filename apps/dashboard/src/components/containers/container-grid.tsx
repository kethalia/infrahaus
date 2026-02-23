"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, Plus, WifiOff, Pause, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ContainerCard } from "./container-card";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { toContainerId } from "@/lib/containers/redis-state";
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
  /** Unique node names for multi-node filtering. Omit or empty to hide filter. */
  nodeNames?: string[];
  /** Names of nodes that failed to respond within timeout */
  failedNodes?: string[];
}

export function ContainerGrid({
  containers,
  proxmoxReachable,
  nodeNames = [],
  failedNodes = [],
}: ContainerGridProps) {
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [nodeFilter, setNodeFilter] = useState<string>("all");
  const [pendingContainers, setPendingContainers] = useState<Set<string>>(
    new Set(),
  );
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const { countdown, isPaused, refreshNow, isRefreshing } = useAutoRefresh({
    intervalSeconds: 30,
  });

  const showNodeFilter = nodeNames.length > 1;

  const filtered = containers.filter((c) => {
    const matchesStatus = filter === "all" || c.status === filter;
    const matchesNode = nodeFilter === "all" || c.node.name === nodeFilter;
    return matchesStatus && matchesNode;
  });

  const handlePendingChange = useCallback(
    (containerId: string, isPending: boolean) => {
      setPendingContainers((prev) => {
        const next = new Set(prev);
        if (isPending) {
          next.add(containerId);
        } else {
          next.delete(containerId);
        }
        return next;
      });
    },
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* All nodes unreachable — error banner with settings link */}
      {!proxmoxReachable && (
        <Alert variant="destructive">
          <WifiOff className="size-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Unable to reach any Proxmox nodes. Container data is unavailable.
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings/nodes">Check Settings</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Partial node failure — dismissible error banner naming failed nodes */}
      {failedNodes.length > 0 && proxmoxReachable && !dismissedBanner && (
        <Alert variant="destructive" className="relative">
          <WifiOff className="size-4" />
          <AlertDescription>
            Unable to reach {failedNodes.join(", ")} — some containers may not
            be shown.
          </AlertDescription>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2 h-6 w-6 p-0"
            onClick={() => setDismissedBanner(true)}
          >
            <X className="size-3.5" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </Alert>
      )}

      {/* Toolbar: filters + refresh controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status filter pills */}
        <div className="flex items-center gap-3">
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

          {/* Node filter — only shown for multi-node users */}
          {showNodeFilter && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Button
                  variant={nodeFilter === "all" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setNodeFilter("all")}
                >
                  All Nodes
                </Button>
                {nodeNames.map((name) => (
                  <Button
                    key={name}
                    variant={nodeFilter === name ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setNodeFilter(name)}
                  >
                    {name}
                  </Button>
                ))}
              </div>
            </>
          )}
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
          {filtered.map((container) => {
            const cid = toContainerId(container.node.name, container.vmid);
            return (
              <ContainerCard
                key={cid}
                container={container}
                isActionPending={pendingContainers.has(cid)}
                onPendingChange={handlePendingChange}
              />
            );
          })}
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
        <h3 className="text-lg font-semibold">No containers found</h3>
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
