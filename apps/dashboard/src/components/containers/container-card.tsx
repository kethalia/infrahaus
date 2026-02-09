import Link from "next/link";
import { Server } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "./status-badge";
import { ContainerActions } from "./container-actions";
import type { ContainerWithStatus } from "@/lib/containers/data";
import type { ServiceStatus } from "@/generated/prisma/client";
import { formatBytes } from "@/lib/utils/format";

/** Color dot for service status */
function ServiceDot({ status }: { status: ServiceStatus }) {
  return (
    <span
      className={
        status === "running"
          ? "size-2 rounded-full bg-emerald-500"
          : status === "stopped"
            ? "size-2 rounded-full bg-gray-400"
            : status === "error"
              ? "size-2 rounded-full bg-red-500"
              : "size-2 rounded-full bg-yellow-400"
      }
    />
  );
}

interface ContainerCardProps {
  container: ContainerWithStatus;
}

export function ContainerCard({ container }: ContainerCardProps) {
  const { id, vmid, hostname, status, services, resources, template, node } =
    container;

  const displayName = hostname ?? `CT ${vmid}`;

  // Show first 2-3 services with colored dots
  const visibleServices = services.slice(0, 3);
  const remainingCount = Math.max(0, services.length - 3);

  // Resource summary text
  const resourceText =
    resources && status === "running"
      ? `CPU ${resources.cpu}% · Mem ${formatBytes(resources.mem)}/${formatBytes(resources.maxmem)}`
      : null;

  return (
    <Card className="relative gap-3 py-4 transition-colors hover:border-foreground/20">
      <CardHeader className="gap-1 py-0">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/containers/${id}`}
            className="group flex min-w-0 flex-1 items-center gap-2"
          >
            <Server className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-semibold group-hover:underline">
              {displayName}
            </span>
          </Link>
          <div className="flex items-center gap-1.5">
            <StatusBadge status={status} />
            <ContainerActions
              containerId={id}
              hostname={hostname}
              vmid={vmid}
              status={status}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>VMID {vmid}</span>
          <span>·</span>
          <span>{node.name}</span>
          {template && (
            <>
              <span>·</span>
              <span className="truncate">{template.name}</span>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-2 py-0">
        {/* Services with colored dots */}
        {services.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {visibleServices.map((service) => (
              <div
                key={service.id}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <ServiceDot status={service.status} />
                <span>{service.name}</span>
              </div>
            ))}
            {remainingCount > 0 && (
              <Link
                href={`/containers/${id}`}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                +{remainingCount} more
              </Link>
            )}
          </div>
        )}

        {/* Resource summary line */}
        {resourceText && (
          <p className="text-xs text-muted-foreground">{resourceText}</p>
        )}
      </CardContent>
    </Card>
  );
}
