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
import { parseContainerId } from "@/lib/containers/redis-state";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: containerId } = await params;

  // Parse compound container ID ({nodeName}/{vmid})
  const decoded = decodeURIComponent(containerId);
  const parsed = parseContainerId(decoded);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid container ID" },
      { status: 400 },
    );
  }

  const redis = getRedis();
  const cache = await getCachedServices(redis, decoded);

  if (!cache) {
    return NextResponse.json({ services: [], containerIp: null });
  }

  const { services, containerIp } = decryptServiceCredentials(cache);

  return NextResponse.json({ services, containerIp });
}
