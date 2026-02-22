"use client";

import { useEffect } from "react";
import { useAction } from "next-safe-action/hooks";

import type { ProxmoxNode } from "@/generated/prisma/client";
import { getNodeContainerCountsAction } from "@/lib/nodes/actions";
import { NodeCard } from "./node-card";

interface NodeCardListProps {
  nodes: ProxmoxNode[];
}

/**
 * Client wrapper that fetches live container counts from Proxmox
 * and passes them to individual NodeCard components.
 */
export function NodeCardList({ nodes }: NodeCardListProps) {
  const { execute, result, isPending } = useAction(
    getNodeContainerCountsAction,
  );

  useEffect(() => {
    execute({});
  }, [execute]);

  const counts = result.data?.counts;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {nodes.map((node) => {
        const count = counts?.[node.id];
        return (
          <NodeCard
            key={node.id}
            node={node}
            containerCount={count}
            containerCountLoading={isPending}
          />
        );
      })}
    </div>
  );
}
