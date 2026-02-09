import { getContainersWithStatus } from "@/lib/containers/data";
import { SummaryBar } from "@/components/containers/summary-bar";
import { ContainerGrid } from "@/components/containers/container-grid";

export default async function DashboardPage() {
  const { containers, counts, proxmoxReachable } =
    await getContainersWithStatus();

  // Compute live running/stopped counts from merged Proxmox data
  const running = containers.filter((c) => c.status === "running").length;
  const stopped = containers.filter((c) => c.status === "stopped").length;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your LXC containers and templates
        </p>
      </div>

      <SummaryBar counts={counts} running={running} stopped={stopped} />

      <ContainerGrid
        containers={containers}
        proxmoxReachable={proxmoxReachable}
      />
    </div>
  );
}
