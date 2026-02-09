"use client";

import {
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Clock,
  Server,
  Shield,
  Tag,
  ArrowUpDown,
  Monitor,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ContainerDetailData } from "@/lib/containers/data";

// ============================================================================
// Helpers
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 1 ? 1 : 0)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  if (seconds === 0) return "N/A";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.length > 0 ? parts.join(" ") : "< 1m";
}

// ============================================================================
// Types
// ============================================================================

interface OverviewTabProps {
  container: ContainerDetailData["container"];
}

// ============================================================================
// Overview Tab
// ============================================================================

export function OverviewTab({ container }: OverviewTabProps) {
  const config = container.config;
  const resources = container.resources;

  // Parse features from config
  const featuresStr = config?.features as string | undefined;
  const features = featuresStr
    ? Object.fromEntries(
        featuresStr.split(",").map((f) => {
          const [key, val] = f.split("=");
          return [key.trim(), val?.trim() === "1"];
        }),
      )
    : {};

  // Parse tags
  const tags = config?.tags
    ? (config.tags as string).split(";").filter(Boolean)
    : [];

  // Parse net0 for network info
  const net0 = config
    ? ((config as Record<string, unknown>)["net0"] as string | undefined)
    : undefined;
  const networkProps = net0
    ? Object.fromEntries(
        net0.split(",").map((p) => {
          const [k, v] = p.split("=");
          return [k, v];
        }),
      )
    : {};

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="size-4" />
            Configuration
          </CardTitle>
          <CardDescription>
            Container settings and configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Hostname</span>
              <p className="font-medium">
                {container.hostname ?? config?.hostname ?? "—"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">VMID</span>
              <p className="font-medium">{container.vmid}</p>
            </div>
            <div>
              <span className="text-muted-foreground">OS Type</span>
              <p className="font-medium">{config?.ostype ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Architecture</span>
              <p className="font-medium">{config?.arch ?? "amd64"}</p>
            </div>
          </div>

          <Separator />

          {/* Resources Config */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Cpu className="text-muted-foreground size-3.5" />
              <div>
                <span className="text-muted-foreground">Cores</span>
                <p className="font-medium">{config?.cores ?? "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MemoryStick className="text-muted-foreground size-3.5" />
              <div>
                <span className="text-muted-foreground">Memory</span>
                <p className="font-medium">
                  {config?.memory ? `${config.memory} MB` : "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="text-muted-foreground size-3.5" />
              <div>
                <span className="text-muted-foreground">Swap</span>
                <p className="font-medium">
                  {config?.swap !== undefined ? `${config.swap} MB` : "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="text-muted-foreground size-3.5" />
              <div>
                <span className="text-muted-foreground">Root Disk</span>
                <p className="font-medium">{config?.rootfs ?? "—"}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Network */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Network className="text-muted-foreground size-3.5" />
              <span className="text-muted-foreground font-medium">Network</span>
            </div>
            {net0 ? (
              <div className="grid grid-cols-2 gap-2 pl-5.5">
                {networkProps.bridge && (
                  <div>
                    <span className="text-muted-foreground">Bridge</span>
                    <p className="font-medium">{networkProps.bridge}</p>
                  </div>
                )}
                {networkProps.ip && (
                  <div>
                    <span className="text-muted-foreground">IP</span>
                    <p className="font-medium">{networkProps.ip}</p>
                  </div>
                )}
                {networkProps.gw && (
                  <div>
                    <span className="text-muted-foreground">Gateway</span>
                    <p className="font-medium">{networkProps.gw}</p>
                  </div>
                )}
                {networkProps.hwaddr && (
                  <div>
                    <span className="text-muted-foreground">MAC</span>
                    <p className="font-mono text-xs">{networkProps.hwaddr}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground pl-5.5">
                No network configured
              </p>
            )}
          </div>

          <Separator />

          {/* Features */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Shield className="text-muted-foreground size-3.5" />
              <span className="text-muted-foreground font-medium">
                Features
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pl-5.5">
              <Badge variant={config?.unprivileged ? "default" : "secondary"}>
                {config?.unprivileged ? "Unprivileged" : "Privileged"}
              </Badge>
              {features.nesting && <Badge variant="outline">Nesting</Badge>}
              {features.keyctl && <Badge variant="outline">Keyctl</Badge>}
              {features.fuse && <Badge variant="outline">FUSE</Badge>}
              {config?.onboot && <Badge variant="outline">Start on boot</Badge>}
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Tag className="text-muted-foreground size-3.5" />
                  <span className="text-muted-foreground font-medium">
                    Tags
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-5.5">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Node</span>
              <p className="font-medium">{container.node.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Template</span>
              <p className="font-medium">{container.template?.name ?? "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Created</span>
              <p className="font-medium">
                {container.createdAt.toLocaleDateString()}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Updated</span>
              <p className="font-medium">
                {container.updatedAt.toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resource Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Monitor className="size-4" />
            Resource Usage
          </CardTitle>
          <CardDescription>
            {resources
              ? "Live data from Proxmox"
              : "Container is stopped or data unavailable"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {resources ? (
            <>
              {/* CPU */}
              <ResourceBar
                icon={<Cpu className="size-3.5" />}
                label="CPU"
                value={resources.cpu}
                max={100}
                formatValue={(v) => `${v}%`}
              />

              {/* Memory */}
              <ResourceBar
                icon={<MemoryStick className="size-3.5" />}
                label="Memory"
                value={resources.mem}
                max={resources.maxmem}
                formatValue={formatBytes}
                formatMax={formatBytes}
              />

              {/* Swap */}
              {resources.maxmem > 0 && (
                <ResourceBar
                  icon={<HardDrive className="size-3.5" />}
                  label="Swap"
                  value={0}
                  max={resources.maxmem}
                  formatValue={formatBytes}
                  formatMax={formatBytes}
                />
              )}

              {/* Disk */}
              <ResourceBar
                icon={<HardDrive className="size-3.5" />}
                label="Disk"
                value={resources.disk}
                max={resources.maxdisk}
                formatValue={formatBytes}
                formatMax={formatBytes}
              />

              <Separator />

              {/* Uptime */}
              <div className="flex items-center gap-2 text-sm">
                <Clock className="text-muted-foreground size-3.5" />
                <span className="text-muted-foreground">Uptime:</span>
                <span className="font-medium">
                  {formatUptime(resources.uptime)}
                </span>
              </div>

              {/* Network I/O — data available from proxmox status but not in
                  the current ContainerWithStatus type. Show uptime only for now. */}
            </>
          ) : (
            <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
              <Monitor className="mb-3 size-8 opacity-30" />
              <p className="text-sm">No resource data available</p>
              <p className="mt-1 text-xs">
                Start the container to see live resource usage.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// ResourceBar Sub-component
// ============================================================================

interface ResourceBarProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  max: number;
  formatValue: (v: number) => string;
  formatMax?: (v: number) => string;
}

function ResourceBar({
  icon,
  label,
  value,
  max,
  formatValue,
  formatMax,
}: ResourceBarProps) {
  const percent = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;

  // Color coding
  let barColor = "bg-primary";
  if (percent > 90) barColor = "bg-destructive";
  else if (percent > 70) barColor = "bg-yellow-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground flex items-center gap-2">
          {icon}
          <span>{label}</span>
        </div>
        <span className="font-medium">
          {formatValue(value)}
          {formatMax && max > 0 && (
            <span className="text-muted-foreground"> / {formatMax(max)}</span>
          )}
        </span>
      </div>
      <div className="bg-muted h-2 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
