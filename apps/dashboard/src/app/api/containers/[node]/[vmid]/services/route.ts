/**
 * API route to fetch discovered services for a container.
 *
 * GET ?discover=true — returns cached services if available, otherwise
 * triggers SSH-based service discovery for running containers and caches
 * the result in Redis (24h TTL). Subsequent calls return the cache.
 *
 * GET (no param) — returns cached services only (no discovery).
 *
 * No credentials in the response — dashboard cards don't need them.
 * Detail page decrypts credentials server-side via RSC.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";
import { getCachedServices } from "@/lib/containers/discovery";
import { toContainerId } from "@/lib/containers/redis-state";
import { getSessionData } from "@/lib/session";

/** Strip credentials from cached services for dashboard display */
function stripCredentials(
  services: {
    name: string;
    type: string;
    port: number | null;
    status: string;
    isSystem: boolean;
  }[],
) {
  return services.map(({ name, type, port, status, isSystem }) => ({
    name,
    type,
    port,
    status,
    isSystem,
  }));
}

export async function GET(
  request: NextRequest,
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

  // Auth check first — prevent unauthenticated access to any service data
  const session = await getSessionData();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const containerId = toContainerId(nodeName, vmid);
  const redis = getRedis();
  const cache = await getCachedServices(redis, containerId);

  // Return cache if available
  if (cache) {
    return NextResponse.json({
      services: stripCredentials(cache.services),
      containerIp: cache.containerIp,
      discoveredAt: cache.discoveredAt,
    });
  }

  // No cache — check if auto-discovery was requested
  const shouldDiscover =
    request.nextUrl.searchParams.get("discover") === "true";

  if (!shouldDiscover) {
    return NextResponse.json({
      services: [],
      containerIp: null,
      discoveredAt: null,
    });
  }

  // Auto-discovery: requires running container + SSH key

  try {
    const { DatabaseService } = await import("@/lib/db");
    const userNodes = await DatabaseService.listNodesForUser(session.address);
    const node = userNodes.find((n) => n.name === nodeName);
    if (!node) {
      return NextResponse.json({
        services: [],
        containerIp: null,
        discoveredAt: null,
      });
    }

    // Check container is running
    const { createSessionClient } = await import("@/lib/containers/helpers");
    const client = await createSessionClient(node);
    const { getContainer, getContainerConfig, getRuntimeIp } =
      await import("@/lib/proxmox/containers");
    const status = await getContainer(client, nodeName, vmid);
    if (status.status !== "running") {
      return NextResponse.json({
        services: [],
        containerIp: null,
        discoveredAt: null,
      });
    }

    // Get SSH key from ContainerCredential DB
    const { getContainerSshKey } = await import("@/lib/containers/ssh-keys");
    const encryptedKey = await getContainerSshKey(containerId);
    if (!encryptedKey) {
      return NextResponse.json({
        services: [],
        containerIp: null,
        discoveredAt: null,
      });
    }

    const { decrypt } = await import("@/lib/encryption");
    const privateKey = decrypt(encryptedKey);

    // Resolve container IP via Proxmox API
    const { extractIpFromNet0 } = await import("@/lib/proxmox/utils");
    const config = await getContainerConfig(client, nodeName, vmid);
    const net0 = (config as Record<string, unknown>)["net0"] as
      | string
      | undefined;
    let containerIp = net0 ? extractIpFromNet0(net0) : null;
    if (!containerIp) {
      containerIp = await getRuntimeIp(client, nodeName, vmid);
    }
    if (!containerIp) {
      return NextResponse.json({
        services: [],
        containerIp: null,
        discoveredAt: null,
      });
    }

    // SSH directly into the container
    const { connectWithRetry } = await import("@/lib/ssh");
    const ssh = await connectWithRetry({
      host: containerIp,
      username: "root",
      privateKey,
    });

    try {
      // Discover and cache
      const { discoverAndCacheServices } =
        await import("@/lib/containers/discovery");
      const newCache = await discoverAndCacheServices(
        redis,
        containerId,
        ssh,
        containerIp,
      );

      return NextResponse.json({
        services: stripCredentials(newCache.services),
        containerIp: newCache.containerIp,
        discoveredAt: newCache.discoveredAt,
      });
    } finally {
      ssh.close();
    }
  } catch (err) {
    console.error(`Service discovery for ${containerId} failed:`, err);
    return NextResponse.json({
      services: [],
      containerIp: null,
      discoveredAt: null,
    });
  }
}
