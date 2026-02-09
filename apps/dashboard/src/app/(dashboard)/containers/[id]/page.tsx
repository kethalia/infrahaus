import { notFound, redirect } from "next/navigation";
import { getContainerDetailData } from "@/lib/containers/data";
import { ContainerDetail } from "./container-detail";

interface ContainerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ContainerDetailPage({
  params,
}: ContainerDetailPageProps) {
  const { id } = await params;

  const data = await getContainerDetailData(id);

  if (!data) {
    notFound();
  }

  // Redirect creating containers to the progress page
  if (data.container.lifecycle === "creating") {
    redirect(`/containers/${id}/progress`);
  }

  return (
    <ContainerDetail
      container={data.container}
      proxmoxReachable={data.proxmoxReachable}
    />
  );
}
