"use client";

import { useState, useCallback } from "react";
import {
  RefreshCw,
  Globe,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  ExternalLink,
  Key,
  ServerCog,
  ChevronDown,
  ScrollText,
  Loader2,
  Cog,
} from "lucide-react";
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ContainerStatus } from "@/lib/containers/data";
import type { ServiceWithCredentials } from "@/lib/containers/discovery";
import { refreshContainerServicesAction } from "@/lib/containers/actions";
import { serviceStatusConfig } from "@/lib/constants/display";

// ============================================================================
// Types
// ============================================================================

interface ServicesTabProps {
  containerId: string;
  services: ServiceWithCredentials[];
  status: ContainerStatus;
  containerIp?: string | null;
}

// ============================================================================
// Services Tab
// ============================================================================

export function ServicesTab({
  containerId,
  services,
  status,
  containerIp,
}: ServicesTabProps) {
  const { execute: executeRefresh, isPending } = useAction(
    refreshContainerServicesAction,
    {
      onSuccess: () => {
        toast.success("Services refreshed");
      },
      onError: ({ error }) => {
        toast.error("Failed to refresh services", {
          description: error.serverError ?? "An unexpected error occurred",
        });
      },
    },
  );

  function handleRefresh() {
    executeRefresh({ containerId });
  }

  const isRunning = status === "running";

  // Split into application vs system services
  const appServices = services.filter((s) => !s.isSystem);
  const systemServices = services.filter((s) => s.isSystem);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ServerCog className="size-4" />
              Services
            </CardTitle>
            <CardDescription>
              {services.length > 0
                ? `${services.length} service${services.length !== 1 ? "s" : ""} discovered`
                : "No services discovered yet"}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isPending || !isRunning}
          >
            <RefreshCw
              className={`size-3.5 ${isPending ? "animate-spin" : ""}`}
            />
            {isPending ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
            <ServerCog className="mb-3 size-8 opacity-30" />
            <p className="text-sm">No services found</p>
            <p className="mt-1 text-xs">
              {isRunning
                ? 'Click "Refresh" to scan for services.'
                : "Start the container, then refresh to discover services."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Application services — always visible */}
            {appServices.length > 0 && (
              <div className="space-y-3">
                {appServices.map((service) => (
                  <ServiceCard
                    key={service.name}
                    containerId={containerId}
                    service={service}
                    containerIp={containerIp}
                  />
                ))}
              </div>
            )}

            {/* System services — collapsible, collapsed by default */}
            {systemServices.length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground group w-full justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Cog className="size-3.5" />
                      System Services ({systemServices.length})
                    </span>
                    <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-3">
                    {systemServices.map((service) => (
                      <ServiceCard
                        key={service.name}
                        containerId={containerId}
                        service={service}
                        containerIp={containerIp}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ServiceCard Sub-component
// ============================================================================

function ServiceCard({
  containerId,
  service,
  containerIp,
}: {
  containerId: string;
  service: ServiceWithCredentials;
  containerIp?: string | null;
}) {
  const [showCredentials, setShowCredentials] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Logs state — fetched on demand only
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string[] | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const statusConf = serviceStatusConfig[service.status] ?? {
    label: service.status,
    className: "bg-gray-500/15 text-gray-700 border-gray-500/25",
  };

  // Construct URL from port + containerIp
  const webUrl =
    service.port && containerIp
      ? `http://${containerIp}:${service.port}`
      : null;

  async function copyToClipboard(value: string, field: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const res = await fetch(
        `/api/containers/${containerId}/services/logs?service=${encodeURIComponent(service.name)}&lines=50`,
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setLogs(data.logs ?? []);
    } catch (err) {
      setLogsError(err instanceof Error ? err.message : "Failed to fetch logs");
    } finally {
      setLogsLoading(false);
    }
  }, [containerId, service.name]);

  function handleToggleLogs() {
    if (!showLogs) {
      // First open — fetch logs
      setShowLogs(true);
      fetchLogs();
    } else {
      setShowLogs(false);
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="text-muted-foreground size-4" />
          <span className="font-medium">{service.name}</span>
          <Badge variant="secondary" className="text-xs">
            {service.type}
          </Badge>
          <Badge variant="outline" className={statusConf.className}>
            {statusConf.label}
          </Badge>
        </div>
        {service.port && (
          <span className="text-muted-foreground text-sm">
            Port {service.port}
          </span>
        )}
      </div>

      {/* Web UI Link */}
      {webUrl && (
        <div className="mt-2 flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={webUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Open Web UI
            </a>
          </Button>
          <span className="text-muted-foreground text-xs">{webUrl}</span>
        </div>
      )}

      {/* Action buttons row */}
      <div className="mt-3 flex items-center gap-1">
        {/* Credentials toggle */}
        {service.credentials && Object.keys(service.credentials).length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCredentials((prev) => !prev)}
          >
            <Key className="size-3" />
            {showCredentials ? "Hide" : "Show"} Credentials
            {showCredentials ? (
              <EyeOff className="size-3" />
            ) : (
              <Eye className="size-3" />
            )}
          </Button>
        )}

        {/* Logs toggle */}
        <Button variant="ghost" size="sm" onClick={handleToggleLogs}>
          {logsLoading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <ScrollText className="size-3" />
          )}
          {showLogs ? "Hide" : "Show"} Logs
          {showLogs ? (
            <EyeOff className="size-3" />
          ) : (
            <Eye className="size-3" />
          )}
        </Button>
      </div>

      {/* Credentials panel */}
      {showCredentials &&
        service.credentials &&
        Object.keys(service.credentials).length > 0 && (
          <div className="mt-2 space-y-1 rounded-md bg-zinc-950 p-3 font-mono text-xs">
            {Object.entries(service.credentials).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between">
                <span>
                  <span className="text-zinc-500">{key}:</span>{" "}
                  <span className="text-zinc-300">{value}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => copyToClipboard(value, key)}
                >
                  {copiedField === key ? (
                    <CheckCircle2 className="size-3 text-green-500" />
                  ) : (
                    <Copy className="size-3 text-zinc-500" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

      {/* Logs panel */}
      {showLogs && (
        <div className="mt-2 rounded-md bg-zinc-950 p-3 font-mono text-xs">
          {logsLoading && (
            <div className="text-muted-foreground flex items-center gap-2 py-2">
              <Loader2 className="size-3 animate-spin" />
              Fetching logs...
            </div>
          )}
          {logsError && <p className="text-red-400">Error: {logsError}</p>}
          {logs && logs.length === 0 && !logsLoading && (
            <p className="text-zinc-500">No log entries found</p>
          )}
          {logs && logs.length > 0 && (
            <div className="flex justify-between pb-1">
              <span className="text-zinc-500">
                {logs.length} line{logs.length !== 1 ? "s" : ""}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-zinc-500 h-auto p-0 text-xs hover:text-zinc-300"
                onClick={fetchLogs}
                disabled={logsLoading}
              >
                <RefreshCw
                  className={`size-3 ${logsLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          )}
          {logs && logs.length > 0 && (
            <div className="max-h-64 overflow-y-auto">
              {logs.map((line, i) => (
                <div key={i} className="text-zinc-300 leading-relaxed">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
