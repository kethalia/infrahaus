import { Box, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ContainerCounts } from "@/lib/db";

interface SummaryBarProps {
  counts: ContainerCounts;
}

const stats = [
  {
    key: "total" as const,
    label: "Total",
    icon: Box,
    color: "text-foreground",
    bgColor: "bg-foreground/5",
  },
  {
    key: "running" as const,
    label: "Running",
    icon: CheckCircle,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10",
  },
  {
    key: "stopped" as const,
    label: "Stopped",
    icon: XCircle,
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-500/10",
  },
  {
    key: "error" as const,
    label: "Error",
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-500/10",
  },
];

/**
 * Compute running/stopped counts from total + creating + error.
 * The DB stores lifecycle (creating/ready/error) — "running" and "stopped"
 * are Proxmox runtime states within "ready" containers. We compute:
 *  stopped = total - creating - ready - error  (approximate; mostly ready - running)
 *  running = ready - stopped
 * But since we don't have live counts here, we show the DB counts
 * and let the caller pass actual running/stopped counts from Proxmox data.
 */
interface SummaryBarWithProxmoxProps {
  counts: ContainerCounts;
  /** Live running count from Proxmox (overrides DB creating count) */
  running: number;
  /** Live stopped count from Proxmox */
  stopped: number;
}

export function SummaryBar({
  counts,
  running,
  stopped,
}: SummaryBarWithProxmoxProps) {
  const displayValues: Record<string, number> = {
    total: counts.total,
    running,
    stopped,
    error: counts.error,
  };

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const value = displayValues[stat.key] ?? 0;

        return (
          <Card key={stat.key} className="gap-2 py-3">
            <CardContent className="flex items-center gap-3 py-0">
              <div className={`rounded-md p-2 ${stat.bgColor}`}>
                <Icon className={`size-4 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold leading-none">{value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
