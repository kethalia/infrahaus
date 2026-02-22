import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getContainersWithStatus } from "@/lib/containers/data";
import { DatabaseService } from "@/lib/db";
import { getSessionData } from "@/lib/session";
import { SummaryBar } from "@/components/containers/summary-bar";
import { ContainerGrid } from "@/components/containers/container-grid";
import { NoNodesBanner } from "@/components/nodes/no-nodes-banner";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSessionData();
  if (!session) redirect("/login");

  // Check if user has any nodes configured
  const userNodes = await DatabaseService.listNodesForUser(session.username);
  const hasNodes = userNodes.length > 0;

  // Only fetch container data if nodes exist
  const { containers, counts, proxmoxReachable } = hasNodes
    ? await getContainersWithStatus(session.username)
    : {
        containers: [],
        counts: { total: 0, creating: 0, ready: 0, error: 0 },
        proxmoxReachable: false,
      };

  // Compute live running/stopped counts from merged Proxmox data
  const running = containers.filter((c) => c.status === "running").length;
  const stopped = containers.filter((c) => c.status === "stopped").length;

  // Extract unique node names for filtering
  const nodeNames = [...new Set(containers.map((c) => c.node.name))];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your LXC containers and templates
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/containers/new">
            <Plus className="size-4" />
            Create Container
          </Link>
        </Button>
      </div>

      {!hasNodes && <NoNodesBanner />}

      {hasNodes && (
        <>
          <SummaryBar counts={counts} running={running} stopped={stopped} />

          <ContainerGrid
            containers={containers}
            proxmoxReachable={proxmoxReachable}
            nodeNames={nodeNames}
          />
        </>
      )}
    </div>
  );
}
