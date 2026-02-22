"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { ContainerHeader } from "@/components/containers/detail/container-header";
import { OverviewTab } from "@/components/containers/detail/overview-tab";
import { ServicesTab } from "@/components/containers/detail/services-tab";
import { EventsTab } from "@/components/containers/detail/events-tab";
import { toContainerId } from "@/lib/containers/redis-state";
import type { ContainerDetailData } from "@/lib/containers/data";

interface ContainerDetailProps {
  container: ContainerDetailData["container"];
  events: ContainerDetailData["events"];
  proxmoxReachable: boolean;
}

export function ContainerDetail({
  container,
  events,
  proxmoxReachable,
}: ContainerDetailProps) {
  const { countdown, isPaused, refreshNow, isRefreshing } = useAutoRefresh({
    intervalSeconds: 30,
  });

  return (
    <div className="space-y-6">
      {/* Header with lifecycle actions */}
      <ContainerHeader
        containerId={toContainerId(container.node.name, container.vmid)}
        hostname={container.hostname}
        vmid={container.vmid}
        status={container.status}
        proxmoxReachable={proxmoxReachable}
      />

      {/* Proxmox unreachable warning */}
      {!proxmoxReachable && (
        <Alert variant="destructive">
          <AlertDescription>
            Unable to reach Proxmox API. Live status and resource data may be
            stale. Actions may not work until connectivity is restored.
          </AlertDescription>
        </Alert>
      )}

      {/* Auto-refresh controls */}
      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="text-muted-foreground">
          {isPaused
            ? "Paused"
            : isRefreshing
              ? "Refreshing..."
              : `Refreshing in ${countdown}s`}
        </span>
        <Button
          variant="ghost"
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

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">
            Services
            {(container.services?.length ?? 0) > 0 && (
              <span className="bg-muted ml-1.5 rounded-full px-1.5 py-0.5 text-xs">
                {container.services?.length ?? 0}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="events">
            Events
            {events.length > 0 && (
              <span className="bg-muted ml-1.5 rounded-full px-1.5 py-0.5 text-xs">
                {events.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab container={container} />
        </TabsContent>

        <TabsContent value="services">
          <ServicesTab
            containerId={toContainerId(container.node.name, container.vmid)}
            nodeName={container.node.name}
            vmid={container.vmid}
            services={container.servicesWithCredentials}
            status={container.status}
            containerIp={container.containerIp}
          />
        </TabsContent>

        <TabsContent value="events">
          <EventsTab events={events} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
