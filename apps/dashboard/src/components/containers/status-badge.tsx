import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContainerStatus } from "@/lib/containers/data";
import { containerStatusConfig } from "@/lib/constants/display";

interface StatusBadgeProps {
  status: ContainerStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = containerStatusConfig[status];

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      <span className={cn("size-1.5 rounded-full", config.dotColor)} />
      {config.label}
    </Badge>
  );
}
