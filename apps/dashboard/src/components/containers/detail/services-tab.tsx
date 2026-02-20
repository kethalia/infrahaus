"use client";

import { useState } from "react";
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
import type { ContainerStatus } from "@/lib/containers/data";
import type { ServiceType, ServiceStatus } from "@/generated/prisma/client";
import { refreshContainerServicesAction } from "@/lib/containers/actions";
import { serviceStatusConfig } from "@/lib/constants/display";

// ============================================================================
// Types
// ============================================================================

interface ServiceWithCredentials {
  id: string;
  name: string;
  type: ServiceType;
  port: number | null;
  webUrl: string | null;
  status: ServiceStatus;
  credentials: Record<string, string> | null;
}

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
          <div className="space-y-4">
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                containerIp={containerIp}
              />
            ))}
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
  service,
  containerIp,
}: {
  service: ServiceWithCredentials;
  containerIp?: string | null;
}) {
  const [showCredentials, setShowCredentials] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const statusConf = serviceStatusConfig[service.status] ?? {
    label: service.status,
    className: "bg-gray-500/15 text-gray-700 border-gray-500/25",
  };

  // Construct URL from port + containerIp when webUrl is not stored in DB
  const webUrl =
    service.webUrl ??
    (service.port && containerIp
      ? `http://${containerIp}:${service.port}`
      : null);

  async function copyToClipboard(value: string, field: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
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

      {/* Per-service credentials (hidden by default) */}
      {service.credentials && Object.keys(service.credentials).length > 0 && (
        <div className="mt-3 space-y-2">
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

          {showCredentials && (
            <div className="space-y-1 rounded-md bg-zinc-950 p-3 font-mono text-xs">
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
                      <Copy className="text-zinc-500 size-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
