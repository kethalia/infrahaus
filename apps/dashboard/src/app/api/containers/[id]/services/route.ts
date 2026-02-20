/**
 * API route to fetch discovered services for a container.
 * Used by the progress page on completion to display services and credentials.
 *
 * Reads from Redis cache (populated by worker or refresh action).
 * Returns { services: [...], containerIp: string | null }
 */

import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/db";
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

  const container = await DatabaseService.getContainerById(containerId);
  if (!container) {
    return NextResponse.json({ error: "Container not found" }, { status: 404 });
  }

  const redis = getRedis();
  const cache = await getCachedServices(redis, containerId);

  if (!cache) {
    return NextResponse.json({ services: [], containerIp: null });
  }

  const { services, containerIp } = decryptServiceCredentials(cache);

  return NextResponse.json({ services, containerIp });
}
