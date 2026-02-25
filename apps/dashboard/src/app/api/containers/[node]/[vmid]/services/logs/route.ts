/**
 * API route to fetch on-demand journalctl logs for a specific service.
 *
 * GET /api/containers/[node]/[vmid]/services/logs?service=<name>&lines=50
 *
 * SSHes directly into the container using the per-container SSH key
 * stored in ContainerCredential (PostgreSQL). Runs `journalctl` to fetch
 * recent log lines. Results are NOT cached — always fresh.
 */

import { NextRequest, NextResponse } from "next/server";
import { DatabaseService } from "@/lib/db";
import { connectWithRetry } from "@/lib/ssh";
import { isSafeShellArg } from "@/lib/utils/validation";
import { decrypt } from "@/lib/encryption";
import { getSessionData } from "@/lib/session";
import { getContainerSshKey } from "@/lib/containers/ssh-keys";
import { toContainerId } from "@/lib/containers/redis-state";
import { createProxmoxClientFromNode } from "@/lib/proxmox";
import { getContainerConfig, getRuntimeIp } from "@/lib/proxmox/containers";
import { extractIpFromNet0 } from "@/lib/proxmox/utils";

const MAX_LOG_LINES = 200;
const DEFAULT_LOG_LINES = 50;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ node: string; vmid: string }> },
) {
  // Auth check — require valid session
  const session = await getSessionData();
  if (!session) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const { node: nodeName, vmid: vmidStr } = await params;
  const vmid = parseInt(vmidStr, 10);
  if (!nodeName || isNaN(vmid)) {
    return NextResponse.json(
      { error: "Invalid container ID" },
      { status: 400 },
    );
  }

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

  // Resolve node from DB by name + userId
  const userNodes = await DatabaseService.listNodesForUser(session.address);
  const dbNode = userNodes.find((n) => n.name === nodeName);
  if (!dbNode) {
    return NextResponse.json({ error: "Node not found" }, { status: 404 });
  }

  // Get SSH key from ContainerCredential DB
  const containerId = toContainerId(nodeName, vmid);
  const encryptedKey = await getContainerSshKey(containerId);
  if (!encryptedKey) {
    return NextResponse.json(
      {
        error: "Container is not managed. Adopt it to enable service logs.",
        managed: false,
      },
      { status: 422 },
    );
  }
  const privateKey = decrypt(encryptedKey);

  // Resolve container IP via Proxmox API
  const client = createProxmoxClientFromNode(dbNode);
  const config = await getContainerConfig(client, nodeName, vmid);
  const net0 = (config as Record<string, unknown>)["net0"] as
    | string
    | undefined;
  let containerIp = net0 ? extractIpFromNet0(net0) : null;
  if (!containerIp) {
    containerIp = await getRuntimeIp(client, nodeName, vmid);
  }
  if (!containerIp) {
    return NextResponse.json(
      { error: "Could not determine container IP" },
      { status: 500 },
    );
  }

  // SSH directly into the container
  let ssh;
  try {
    ssh = await connectWithRetry({
      host: containerIp,
      username: "root",
      privateKey,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to connect to container via SSH" },
      { status: 502 },
    );
  }

  try {
    // Append .service if not already present for systemd unit matching
    const unit = serviceName.endsWith(".service")
      ? serviceName
      : `${serviceName}.service`;

    const result = await ssh.exec(
      `journalctl -u ${unit} -n ${lines} --no-pager --output=short 2>&1`,
    );

    const logLines = result.stdout
      .trim()
      .split("\n")
      .filter((line: string) => line.trim());

    return NextResponse.json({ logs: logLines, service: serviceName });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch service logs" },
      { status: 500 },
    );
  } finally {
    ssh.close();
  }
}
