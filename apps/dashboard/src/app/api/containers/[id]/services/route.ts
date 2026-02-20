/**
 * API route to fetch discovered services for a container.
 * Used by the progress page on completion to display services and credentials.
 *
 * Returns { services: [...], containerIp: string | null }
 */

import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { getProxmoxClient } from "@/lib/proxmox";
import { getContainerConfig, getRuntimeIp } from "@/lib/proxmox/containers";
import { extractIpFromNet0 } from "@/lib/proxmox/utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: containerId } = await params;

  const container = await DatabaseService.getContainerById(containerId);
  if (!container) {
    return NextResponse.json({ error: "Container not found" }, { status: 404 });
  }

  const services = await DatabaseService.getContainerServices(containerId);

  // Decrypt credentials server-side before sending to client
  const decryptedServices = services.map((service) => ({
    ...service,
    credentials: service.credentials
      ? (() => {
          try {
            return decrypt(service.credentials);
          } catch {
            return null;
          }
        })()
      : null,
  }));

  // Resolve container IP from Proxmox for URL construction.
  // Try static config first, then query the live LXC interfaces (DHCP).
  let containerIp: string | null = null;
  try {
    const node = await DatabaseService.getNodeById(container.nodeId);
    if (node) {
      const client = await getProxmoxClient();

      // 1. Try static IP from net0 config
      const config = await getContainerConfig(
        client,
        node.name,
        container.vmid,
      );
      const net0 = (config as Record<string, unknown>)["net0"] as
        | string
        | undefined;
      if (net0) {
        containerIp = extractIpFromNet0(net0);
      }

      // 2. Fallback: query live LXC interfaces (works for DHCP)
      if (!containerIp) {
        containerIp = await getRuntimeIp(client, node.name, container.vmid);
      }
    }
  } catch {
    // Non-fatal — URLs just won't be constructed client-side
  }

  return NextResponse.json({ services: decryptedServices, containerIp });
}
