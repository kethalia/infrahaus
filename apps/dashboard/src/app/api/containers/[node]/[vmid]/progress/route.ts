/**
 * SSE endpoint for real-time container creation progress.
 *
 * On connect:
 * 1. Check Redis creation state for the VMID
 * 2. Replay log buffer entries from Redis ring buffer
 * 3. If terminal state (ready/error), close after replay
 * 4. Otherwise subscribe to Redis Pub/Sub for live events
 * 5. Send heartbeat every 15s, clean up on client disconnect
 *
 * No DB dependency — uses Redis creation state + log buffer exclusively.
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import Redis from "ioredis";
import {
  SSE_HEARTBEAT_INTERVAL_MS,
  getLogBufferKey,
} from "@/lib/constants/infrastructure";
import { getRedis } from "@/lib/redis";
import { getCreationJob, toContainerId } from "@/lib/containers/redis-state";
import {
  getProgressChannel,
  type ContainerProgressEvent,
} from "@/lib/queue/container-creation";

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

  // Check Redis creation state
  const redis = getRedis();
  const creationJob = await getCreationJob(redis, nodeName, vmid);

  // Fetch the log ring buffer for replay
  const redisUrl = process.env.REDIS_URL;
  let bufferedLogs: string[] = [];
  if (redisUrl) {
    const replayClient = new Redis(redisUrl);
    try {
      bufferedLogs = await replayClient.lrange(
        getLogBufferKey(containerId),
        0,
        -1,
      );
    } finally {
      replayClient.disconnect();
    }
  }

  // If no creation job and no log buffer, nothing to stream
  if (!creationJob && bufferedLogs.length === 0) {
    return NextResponse.json(
      { error: "No active creation found" },
      { status: 404 },
    );
  }

  const isTerminal =
    creationJob?.lifecycle === "ready" || creationJob?.lifecycle === "error";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
      let subscriber: Redis | null = null;
      let closed = false;

      function send(event: string, data: string) {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${data}\n\n`),
          );
        } catch {
          // Stream closed
          cleanup();
        }
      }

      function cleanup() {
        if (closed) return;
        closed = true;
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        if (subscriber) {
          subscriber.unsubscribe().catch(() => {});
          subscriber.disconnect();
          subscriber = null;
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }

      // Build snapshot from log buffer: parse ContainerProgressEvent objects
      // directly from the ring buffer to derive current progress state.
      let lastStep: string | null = null;
      let lastPercent = 0;
      const seenSteps: string[] = [];
      let snapshotScriptNames: string[] | undefined;
      let snapshotScriptTotal: number | undefined;
      const snapshotCompletedScripts: string[] = [];
      let snapshotActiveScript: string | null = null;
      let hasError = false;
      let errorMessage: string | null = null;

      for (const raw of bufferedLogs) {
        try {
          const event = JSON.parse(raw) as ContainerProgressEvent;

          if (event.step && !seenSteps.includes(event.step)) {
            seenSteps.push(event.step);
          }

          if (event.step) {
            lastStep = event.step;
          }
          if (event.percent !== undefined) {
            lastPercent = event.percent;
          }

          // Extract script tracking info
          if (event.scriptNames) {
            snapshotScriptNames = event.scriptNames;
          }
          if (event.scriptTotal != null) {
            snapshotScriptTotal = event.scriptTotal;
          }
          // Script completion: events with scriptName on syncing steps
          if (event.scriptName && event.step === "syncing") {
            if (!snapshotCompletedScripts.includes(event.scriptName)) {
              snapshotCompletedScripts.push(event.scriptName);
            }
          }

          if (event.type === "error") {
            hasError = true;
            errorMessage = event.message;
          }
        } catch {
          // Skip unparseable entries
        }
      }

      // Determine active script
      if (snapshotScriptNames && !isTerminal && lastStep === "syncing") {
        snapshotActiveScript =
          snapshotScriptNames.find(
            (name) => !snapshotCompletedScripts.includes(name),
          ) ?? null;
      }

      // Check terminal state from Redis creation job lifecycle
      const isComplete = isTerminal && creationJob?.lifecycle === "ready";
      const isError =
        hasError || (isTerminal && creationJob?.lifecycle === "error");

      // Send a single snapshot event with the current state
      send(
        "snapshot",
        JSON.stringify({
          step: lastStep,
          percent: isComplete ? 100 : lastPercent,
          seenSteps,
          isComplete,
          isError,
          errorMessage:
            errorMessage ||
            (isError
              ? (creationJob?.errorMessage ?? "Container creation failed")
              : null),
          scriptNames: snapshotScriptNames,
          scriptTotal: snapshotScriptTotal,
          completedScripts:
            snapshotCompletedScripts.length > 0
              ? snapshotCompletedScripts
              : undefined,
          activeScript: snapshotActiveScript,
        }),
      );

      // Replay buffered log/step events from the Redis ring buffer
      for (const raw of bufferedLogs) {
        send("progress", raw);
      }

      // If container is already in terminal state, close after replay
      if (isTerminal) {
        send("done", JSON.stringify({ reason: "terminal" }));
        cleanup();
        return;
      }

      // Subscribe to Redis Pub/Sub for live events
      if (!redisUrl) {
        send(
          "progress",
          JSON.stringify({
            type: "error",
            message: "Server configuration error: Redis not configured",
            timestamp: new Date().toISOString(),
          } satisfies ContainerProgressEvent),
        );
        cleanup();
        return;
      }

      subscriber = new Redis(redisUrl);
      const channel = getProgressChannel(containerId);

      subscriber.subscribe(channel).catch((err) => {
        console.error("Redis subscribe error:", err);
        cleanup();
      });

      subscriber.on("message", (_ch: string, message: string) => {
        send("progress", message);

        // Check if this is a terminal event
        try {
          const parsed = JSON.parse(message) as ContainerProgressEvent;
          if (parsed.type === "complete" || parsed.type === "error") {
            send("done", JSON.stringify({ reason: parsed.type }));
            cleanup();
          }
        } catch {
          // Not valid JSON, ignore
        }
      });

      subscriber.on("error", (err) => {
        console.error("Redis subscriber error:", err);
        cleanup();
      });

      // Heartbeat to keep connection alive
      heartbeatInterval = setInterval(() => {
        send("heartbeat", JSON.stringify({ time: new Date().toISOString() }));
      }, SSE_HEARTBEAT_INTERVAL_MS);

      // Clean up on client disconnect
      _request.signal.addEventListener("abort", () => {
        cleanup();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
