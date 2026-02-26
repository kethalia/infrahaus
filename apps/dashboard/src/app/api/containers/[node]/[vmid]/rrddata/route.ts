/**
 * API route for container RRD (Round Robin Database) time-series data.
 *
 * Proxies the Proxmox rrddata endpoint which returns pre-aggregated metrics
 * (~70 data points) for either the last hour or last 24 hours.
 * Used by the resource history charts on the container detail page.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/session";
import { DatabaseService } from "@/lib/db";
import { createSessionClient } from "@/lib/containers/helpers";
import { getContainerRrdData } from "@/lib/proxmox/containers";

export async function GET(
  request: NextRequest,
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

  const timeframe = request.nextUrl.searchParams.get("timeframe");
  if (timeframe !== "hour" && timeframe !== "day") {
    return NextResponse.json(
      { error: "Invalid timeframe — must be 'hour' or 'day'" },
      { status: 400 },
    );
  }

  try {
    // Find the node in user's nodes
    const userNodes = await DatabaseService.listNodesForUser(session.address);
    const node = userNodes.find((n) => n.name === nodeName);
    if (!node) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    const client = await createSessionClient(node);
    const data = await getContainerRrdData(client, nodeName, vmid, timeframe);

    return NextResponse.json(data);
  } catch (err) {
    console.error(
      `RRD data fetch for CT ${vmid} on ${nodeName} (${timeframe}) failed:`,
      err,
    );
    return NextResponse.json(
      { error: "Failed to fetch RRD data" },
      { status: 502 },
    );
  }
}
