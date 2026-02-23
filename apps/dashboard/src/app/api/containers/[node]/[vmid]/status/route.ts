/**
 * Lightweight API route for container resource metrics polling.
 *
 * Returns only the Proxmox container status (CPU, memory, disk, network, uptime).
 * Used by the detail page's useResourcePolling hook at 2s intervals.
 * Does NOT fetch config, services, events, etc.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/session";
import { DatabaseService } from "@/lib/db";
import { createSessionClient } from "@/lib/containers/helpers";
import { getContainer } from "@/lib/proxmox/containers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ node: string; vmid: string }> },
) {
  const session = await getSessionData();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { node: nodeName, vmid: vmidStr } = await params;
  const vmid = parseInt(vmidStr, 10);
  if (!nodeName || isNaN(vmid)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  try {
    // Find the node in user's nodes
    const userNodes = await DatabaseService.listNodesForUser(session.address);
    const node = userNodes.find((n) => n.name === nodeName);
    if (!node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    const client = await createSessionClient(node);
    const status = await getContainer(client, nodeName, vmid);

    return NextResponse.json({
      cpu: Math.round((status.cpu ?? 0) * 100),
      mem: status.mem ?? 0,
      maxmem: status.maxmem ?? 0,
      disk: status.disk ?? 0,
      maxdisk: status.maxdisk ?? 0,
      uptime: status.uptime ?? 0,
      netin: status.netin ?? 0,
      netout: status.netout ?? 0,
      status: status.status,
    });
  } catch (err) {
    console.error(`Resource poll for CT ${vmid} on ${nodeName} failed:`, err);
    return NextResponse.json(
      { error: "Failed to fetch container status" },
      { status: 502 },
    );
  }
}
