import { redirect } from "next/navigation";
import { getWizardData } from "@/lib/containers/actions";
import { getSessionData } from "@/lib/session";
import { ContainerWizard } from "./container-wizard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Create Container",
  description: "Configure and deploy a new LXC container",
};

export default async function NewContainerPage() {
  const session = await getSessionData();
  if (!session) redirect("/login");

  const {
    templates,
    storages,
    bridges,
    nextVmid,
    noNodeConfigured,
    osTemplates,
    clusterNodes,
  } = await getWizardData(session.username);

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
      />
    </div>
  );
}
