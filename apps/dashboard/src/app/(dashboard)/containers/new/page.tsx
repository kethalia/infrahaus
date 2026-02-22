import { redirect } from "next/navigation";
import { getWizardData } from "@/lib/containers/actions";
import { getSessionData } from "@/lib/session";
import { DatabaseService } from "@/lib/db";
import { createSessionClient } from "@/lib/containers/helpers";
import { refreshVmidCache } from "@/lib/vmid-cache";
import { NoNodesBanner } from "@/components/nodes/no-nodes-banner";
import { ContainerWizard } from "./container-wizard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create Container",
  description: "Configure and deploy a new LXC container",
};

export default async function NewContainerPage() {
  const session = await getSessionData();
  if (!session) redirect("/login");

  const userId = session.username;

  // Get user's nodes and default node
  const defaultNode = await DatabaseService.getDefaultNodeForUser(userId);
  const userNodes = await DatabaseService.listNodesForUser(userId);

  // If no nodes configured, show banner instead of wizard
  if (!defaultNode || userNodes.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Create Container
          </h1>
          <p className="text-muted-foreground">
            Configure and deploy a new LXC container
          </p>
        </div>
        <NoNodesBanner />
      </div>
    );
  }

  // Refresh VMID cache for default node on page load
  try {
    const client = await createSessionClient(defaultNode);
    await refreshVmidCache(defaultNode.id, defaultNode.name, client);
  } catch (err) {
    // Non-fatal: wizard still works, just won't have fresh cache
    console.warn(
      "Failed to refresh VMID cache on wizard load:",
      err instanceof Error ? err.message : String(err),
    );
  }

  // Fetch wizard data (templates, storages, bridges, etc.)
  const {
    templates,
    storages,
    bridges,
    nextVmid,
    noNodeConfigured,
    osTemplates,
    clusterNodes,
  } = await getWizardData(userId);

  // Map user nodes to simple objects for the client component
  const userNodesList = userNodes.map((n) => ({
    id: n.id,
    name: n.name,
    isDefault: n.isDefault,
  }));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Container</h1>
        <p className="text-muted-foreground">
          Configure and deploy a new LXC container
        </p>
      </div>
      <ContainerWizard
        templates={templates}
        storages={storages}
        bridges={bridges}
        nextVmid={nextVmid}
        noNodeConfigured={noNodeConfigured}
        osTemplates={osTemplates}
        clusterNodes={clusterNodes}
        defaultNodeId={defaultNode.id}
        userNodes={userNodesList}
      />
    </div>
  );
}
