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
import type { ContainerDetailData } from "@/lib/containers/data";

interface ContainerDetailProps {
  container: ContainerDetailData["container"];
  proxmoxReachable: boolean;
}

export function ContainerDetail({
  container,
  proxmoxReachable,
}: ContainerDetailProps) {
  const { countdown, isPaused, refreshNow, isRefreshing } = useAutoRefresh({
    intervalSeconds: 30,
  });

  return (
    <div className="space-y-6">
      {/* Header with lifecycle actions */}
      <ContainerHeader
        containerId={container.id}
        hostname={container.hostname}
        vmid={container.vmid}
        status={container.status}
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
            {container.services.length > 0 && (
              <span className="bg-muted ml-1.5 rounded-full px-1.5 py-0.5 text-xs">
                {container.services.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="events">
            Events
            {container.allEvents.length > 0 && (
              <span className="bg-muted ml-1.5 rounded-full px-1.5 py-0.5 text-xs">
                {container.allEvents.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab container={container} />
        </TabsContent>

        <TabsContent value="services">
          <ServicesTab
            containerId={container.id}
            services={container.services}
            status={container.status}
            nodeHost={container.node.host}
          />
        </TabsContent>

        <TabsContent value="events">
          <EventsTab events={container.allEvents} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
