/**
 * API route to fetch discovered services for a container.
 * Used by the progress page on completion to display services and credentials.
 *
 * Reads from Redis cache (populated by worker or refresh action).
 * No DB dependency — if cache exists, return it; otherwise empty array.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import {
  getCachedServices,
  decryptServiceCredentials,
} from "@/lib/containers/discovery";
import { toContainerId } from "@/lib/containers/redis-state";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ node: string; vmid: string }> },
) {
  const { node: nodeName, vmid: vmidStr } = await params;
  const vmid = parseInt(vmidStr, 10);
  if (!nodeName || isNaN(vmid)) {
    return NextResponse.json(
      { error: "Invalid container ID" },
      { status: 400 },
    );
  }

  const containerId = toContainerId(nodeName, vmid);
  const redis = getRedis();
  const cache = await getCachedServices(redis, containerId);

  if (!cache) {
    return NextResponse.json({
      services: [],
      containerIp: null,
      discoveredAt: null,
    });
  }

  const { services, containerIp, discoveredAt } =
    decryptServiceCredentials(cache);

  return NextResponse.json({ services, containerIp, discoveredAt });
}
