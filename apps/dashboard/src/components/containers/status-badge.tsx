import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContainerStatus } from "@/lib/containers/data";

const statusConfig: Record<
  ContainerStatus,
  { label: string; className: string }
> = {
  running: {
    label: "Running",
    className:
      "bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-400",
  },
  stopped: {
    label: "Stopped",
    className:
      "bg-gray-500/15 text-gray-700 border-gray-500/25 dark:text-gray-400",
  },
  creating: {
    label: "Creating",
    className:
      "bg-blue-500/15 text-blue-700 border-blue-500/25 dark:text-blue-400",
  },
  error: {
    label: "Error",
    className: "bg-red-500/15 text-red-700 border-red-500/25 dark:text-red-400",
  },
  unknown: {
    label: "Unknown",
    className:
      "bg-yellow-500/15 text-yellow-700 border-yellow-500/25 dark:text-yellow-400",
  },
};

interface StatusBadgeProps {
  status: ContainerStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "running" && "bg-emerald-500",
          status === "stopped" && "bg-gray-500",
          status === "creating" && "bg-blue-500 animate-pulse",
          status === "error" && "bg-red-500",
          status === "unknown" && "bg-yellow-500",
        )}
      />
      {config.label}
    </Badge>
  );
}
