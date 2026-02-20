/**
 * API route to fetch on-demand journalctl logs for a specific service.
 *
 * GET /api/containers/[id]/services/logs?service=<name>&lines=50
 *
 * Connects to the PVE host via SSH and runs `pct exec <vmid> -- journalctl`
 * to fetch recent log lines. Results are NOT cached — always fresh.
 */

import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/db";
import { connectWithRetry, PctExecSession } from "@/lib/ssh";
import { isSafeShellArg } from "@/lib/utils/validation";

const MAX_LOG_LINES = 200;
const DEFAULT_LOG_LINES = 50;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: containerId } = await params;
  const { searchParams } = request.nextUrl;

  const serviceName = searchParams.get("service");
  const linesParam = searchParams.get("lines");
  const lines = Math.min(
    Math.max(
      parseInt(linesParam ?? String(DEFAULT_LOG_LINES), 10) ||
        DEFAULT_LOG_LINES,
      1,
    ),
    MAX_LOG_LINES,
  );

  if (!serviceName) {
    return NextResponse.json(
      { error: "Missing 'service' query parameter" },
      { status: 400 },
    );
  }

  // Validate service name to prevent shell injection
  if (!isSafeShellArg(serviceName)) {
    return NextResponse.json(
      { error: "Invalid service name" },
      { status: 400 },
    );
  }

  const container = await DatabaseService.getContainerById(containerId);
  if (!container) {
    return NextResponse.json({ error: "Container not found" }, { status: 404 });
  }

  // SSH to PVE host → pct exec into container → journalctl
  const pveHost = process.env.PVE_HOST;
  const pveRootPassword = process.env.PVE_ROOT_PASSWORD;

  if (!pveHost || !pveRootPassword) {
    return NextResponse.json(
      { error: "PVE_HOST and PVE_ROOT_PASSWORD are required" },
      { status: 500 },
    );
  }

  let sshHost;
  try {
    sshHost = await connectWithRetry({
      host: pveHost,
      username: "root",
      password: pveRootPassword,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to connect to Proxmox host" },
      { status: 502 },
    );
  }

  try {
    const pct = new PctExecSession(sshHost, container.vmid);

    // Append .service if not already present for systemd unit matching
    const unit = serviceName.endsWith(".service")
      ? serviceName
      : `${serviceName}.service`;

    const result = await pct.exec(
      `journalctl -u ${unit} -n ${lines} --no-pager --output=short 2>&1`,
    );

    const logLines = result.stdout
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    return NextResponse.json({ logs: logLines, service: serviceName });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch service logs" },
      { status: 500 },
    );
  } finally {
    sshHost.close();
  }
}
