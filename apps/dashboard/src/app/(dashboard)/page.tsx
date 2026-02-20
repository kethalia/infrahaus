import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getContainersWithStatus } from "@/lib/containers/data";
import { getSessionData } from "@/lib/session";
import { SummaryBar } from "@/components/containers/summary-bar";
import { ContainerGrid } from "@/components/containers/container-grid";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSessionData();
  if (!session) redirect("/login");

  const { containers, counts, proxmoxReachable } =
    await getContainersWithStatus(session.username);

  // Compute live running/stopped counts from merged Proxmox data
  const running = containers.filter((c) => c.status === "running").length;
  const stopped = containers.filter((c) => c.status === "stopped").length;

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

      <SummaryBar counts={counts} running={running} stopped={stopped} />

      <ContainerGrid
        containers={containers}
        proxmoxReachable={proxmoxReachable}
      />
    </div>
  );
}
