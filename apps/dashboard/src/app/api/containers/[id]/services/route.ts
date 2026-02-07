/**
 * API route to fetch discovered services for a container.
 * Used by the progress page on completion to display services and credentials.
 */

import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/db";

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

  return NextResponse.json(services);
}
