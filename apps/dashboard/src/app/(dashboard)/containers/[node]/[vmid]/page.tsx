import { redirect } from "next/navigation";
import { getContainerDetailData } from "@/lib/containers/data";
import { getSessionData } from "@/lib/session";
import { toContainerId } from "@/lib/containers/redis-state";
import { ContainerDetail } from "./container-detail";

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

  const data = await getContainerDetailData(containerId, session.username);

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

  return (
    <ContainerDetail
      container={data.container}
      events={data.events}
      proxmoxReachable={data.proxmoxReachable}
    />
  );
}
