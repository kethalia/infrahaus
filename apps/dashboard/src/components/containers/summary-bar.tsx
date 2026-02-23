import { Box, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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

interface SummaryBarProps {
  counts: { total: number; running: number; stopped: number; error: number };
}

export function SummaryBar({ counts }: SummaryBarProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const value = counts[stat.key] ?? 0;

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
