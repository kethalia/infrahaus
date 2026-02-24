import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Server } from "lucide-react";
import { getContainersWithStatus } from "@/lib/containers/data";
import { DatabaseService } from "@/lib/db";
import { getSessionData } from "@/lib/session";
import { SummaryBar } from "@/components/containers/summary-bar";
import { ContainerGrid } from "@/components/containers/container-grid";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSessionData();
  if (!session) redirect("/login");

  // Check if user has any nodes configured
  const userNodes = await DatabaseService.listNodesForUser(session.address);
  const hasNodes = userNodes.length > 0;

  // Only fetch container data if nodes exist
  const { containers, counts, proxmoxReachable, failedNodes } = hasNodes
    ? await getContainersWithStatus(session.address)
    : {
        containers: [],
        counts: { total: 0, running: 0, stopped: 0, error: 0 },
        proxmoxReachable: false,
        failedNodes: [] as string[],
      };

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
        {hasNodes ? (
          <Button asChild size="sm">
            <Link href="/containers/new">
              <Plus className="size-4" />
              Create Container
            </Link>
          </Button>
        ) : (
          <Button size="sm" disabled>
            <Plus className="size-4" />
            Create Container
          </Button>
        )}
      </div>

      {!hasNodes && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="rounded-full bg-muted p-4">
            <Server className="size-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              No Proxmox nodes configured
            </h3>
            <p className="text-sm text-muted-foreground">
              Add a node to start managing containers. You&apos;ll need your
              Proxmox host address and an API token.
            </p>
          </div>
          <Button asChild>
            <Link href="/settings/nodes">Add Your First Node</Link>
          </Button>
        </div>
      )}

      {hasNodes && (
        <>
          <SummaryBar counts={counts} />

          <ContainerGrid
            containers={containers}
            proxmoxReachable={proxmoxReachable}
            nodeNames={nodeNames}
            failedNodes={failedNodes}
          />
        </>
      )}
      {/* Template browsing and non-Proxmox features still work even without nodes.
          Container operations are disabled via NoNodesBanner messaging. */}
    </div>
  );
}
