import Link from "next/link";
import { redirect } from "next/navigation";
import { WifiOff } from "lucide-react";
import { getContainerDetailData } from "@/lib/containers/data";
import { getSessionData } from "@/lib/session";
import { toContainerId } from "@/lib/containers/redis-state";
import { ContainerDetail } from "./container-detail";
import { Button } from "@/components/ui/button";

interface ContainerDetailPageProps {
  params: Promise<{ node: string; vmid: string }>;
}

export default async function ContainerDetailPage({
  params,
}: ContainerDetailPageProps) {
  const { node, vmid } = await params;
  const containerId = toContainerId(node, parseInt(vmid, 10));

  const session = await getSessionData();
  if (!session) redirect("/login");

  const data = await getContainerDetailData(containerId, session.address);

  if (!data) {
    // Container was deleted or never existed — redirect home rather than 404.
    // This also handles the race where Next.js re-renders this RSC immediately
    // after deleteContainerAction completes before router.push("/") fires.
    redirect("/");
  }

  // Redirect creating containers to the progress page
  if (data.container.status === "creating") {
    redirect(`/containers/${node}/${vmid}/progress`);
  }

  // Node unreachable — show error page instead of stale/empty detail
  if (!data.proxmoxReachable && data.container.status === "unknown") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16">
        <WifiOff className="size-12 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-lg font-semibold">Unable to Reach Node</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The Proxmox node hosting this container is currently unreachable.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <ContainerDetail
      container={data.container}
      events={data.events}
      proxmoxReachable={data.proxmoxReachable}
    />
  );
}
