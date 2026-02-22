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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: containerId } = await params;

  // Parse vmid from URL param
  const vmid = parseInt(containerId, 10);
  if (isNaN(vmid)) {
    return NextResponse.json(
      { error: "Invalid container ID" },
      { status: 400 },
    );
  }

  const redis = getRedis();
  const cache = await getCachedServices(redis, String(vmid));

  if (!cache) {
    return NextResponse.json({ services: [], containerIp: null });
  }

  const { services, containerIp } = decryptServiceCredentials(cache);

  return NextResponse.json({ services, containerIp });
}
