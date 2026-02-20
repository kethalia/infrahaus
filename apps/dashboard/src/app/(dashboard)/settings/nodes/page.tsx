import { redirect } from "next/navigation";
import { Server } from "lucide-react";

import { getSessionData } from "@/lib/session";
import { DatabaseService } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { NodeCard } from "@/components/nodes/node-card";
import { NodeFormDialog } from "@/components/nodes/node-form-dialog";
import { NoNodesBanner } from "@/components/nodes/no-nodes-banner";

export const dynamic = "force-dynamic";

export default async function NodesSettingsPage() {
  const session = await getSessionData();
  if (!session) redirect("/login");

  const nodes = await DatabaseService.getUserNodesWithContainerCount(
    session.username,
  );

  return (
    <div className="flex flex-1 flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Proxmox Nodes</h1>
          <p className="text-muted-foreground">
            Manage your Proxmox VE connections
          </p>
        </div>
        <div className="mt-2 sm:mt-0">
          <NodeFormDialog
            mode="create"
            trigger={
              <Button>
                <Server className="size-4" />
                Add Node
              </Button>
            }
          />
        </div>
      </div>

      {/* Content */}
      {nodes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <NoNodesBanner />
          <NodeFormDialog
            mode="create"
            trigger={
              <Button>
                <Server className="size-4" />
                Add Your First Node
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {nodes.map((node) => (
            <NodeCard key={node.id} node={node} />
          ))}
        </div>
      )}
    </div>
  );
}
