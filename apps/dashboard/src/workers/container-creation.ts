/**
 * Container Creation Worker
 *
 * Standalone BullMQ worker process that executes the 5-phase container creation pipeline:
 * 1. Create LXC container via Proxmox API
 * 2. Start container via Proxmox API
 * 3. Deploy template files via SSH
 * 4. Install packages + execute template scripts via SSH
 * 5. Discover services/credentials + finalize
 *
 * Run via: pnpm dev:worker (tsx --watch)
 */

import { Worker, type Job } from "bullmq";
import Redis from "ioredis";
import { z } from "zod";
import {
  type ContainerJobData,
  type ContainerJobResult,
  type ContainerProgressEvent,
  getProgressChannel,
} from "../lib/queue/container-creation";
import {
  DatabaseService,
  ContainerLifecycle,
  EventType,
  prisma,
} from "../lib/db";
import { getProxmoxClient } from "../lib/proxmox";
import { type ProxmoxClient } from "../lib/proxmox/client";
import { createContainer, startContainer } from "../lib/proxmox/containers";
import { waitForTask } from "../lib/proxmox/tasks";
import { connectWithRetry, PctExecSession, type SSHSession } from "../lib/ssh";
import {
  CONTAINER_CREATION_QUEUE,
  WORKER_CONCURRENCY,
  CREDENTIALS_DIR,
  getLogBufferKey,
  CONTAINER_LOG_BUFFER_MAX,
  CONTAINER_LOG_BUFFER_TTL_S,
} from "../lib/constants/infrastructure";
import { discoverAndCacheServices } from "../lib/containers/discovery";
import {
  TASK_POLL_INTERVAL_MS,
  TASK_TIMEOUT_LONG_MS,
  TASK_TIMEOUT_MS,
  CONTAINER_FILESYSTEM_READY_MAX_ATTEMPTS,
  CONTAINER_FILESYSTEM_CHECK_DELAY_MS,
} from "../lib/constants/timeouts";

// ============================================================================
// Redis Connections
// ============================================================================
console.log(process.env.REDIS_URL);
// Worker connection MUST have maxRetriesPerRequest: null for BullMQ
const workerConnection = new Redis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

// Separate connection for Pub/Sub publishing
const publisher = new Redis(process.env.REDIS_URL!);

// ============================================================================
// Progress Helper
// ============================================================================

/**
 * Publish a progress event to Redis Pub/Sub and persist to DB.
 * Log events are buffered in a Redis ring buffer (replay on page refresh).
 * Step, complete, and error events are also persisted to DB for audit.
 */
async function publishProgress(
  containerId: string,
  event: Omit<ContainerProgressEvent, "timestamp">,
): Promise<void> {
  const fullEvent: ContainerProgressEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  const serialized = JSON.stringify(fullEvent);

  // Publish to Redis Pub/Sub for real-time SSE subscribers
  await publisher.publish(getProgressChannel(containerId), serialized);

  // Push ALL events (including logs) to the ring buffer so they can be
  // replayed when the progress page is refreshed.
  const logKey = getLogBufferKey(containerId);
  await publisher
    .pipeline()
    .rpush(logKey, serialized)
    .ltrim(logKey, -CONTAINER_LOG_BUFFER_MAX, -1) // keep last N entries
    .expire(logKey, CONTAINER_LOG_BUFFER_TTL_S)
    .exec();

  // Only persist step, complete, and error events to DB (skip log events)
  if (event.type !== "log") {
    // Map progress event type + step to the appropriate DB EventType
    const stepToEventType: Record<string, EventType> = {
      creating: EventType.created,
      starting: EventType.started,
      deploying: EventType.service_ready,
      syncing: EventType.script_completed,
      finalizing: EventType.service_ready,
    };

    const dbEventType =
      event.type === "complete"
        ? EventType.created
        : event.type === "error"
          ? EventType.error
          : (event.step && stepToEventType[event.step]) ||
            EventType.script_completed;

    await DatabaseService.createContainerEvent({
      containerId,
      type: dbEventType,
      message: event.message,
      metadata: JSON.stringify({ step: event.step, percent: event.percent }),
    });
  }
}

// ============================================================================
// IP Extraction Helper
// ============================================================================

/**
 * Extract IP address from Proxmox ipConfig string.
 * Handles formats like "ip=10.0.0.50/24,gw=10.0.0.1"
 */
function extractIpFromConfig(ipConfig: string): string | null {
  // Handle "ip=10.0.0.50/24,gw=10.0.0.1"
  const match = ipConfig.match(/ip=(\d+\.\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

const IPV4_RE = /^\d+\.\d+\.\d+\.\d+$/;

/**
 * Resolve the container's IPv4 address using multiple strategies:
 *   1. Static IP from the Proxmox ipConfig string
 *   2. `hostname -I` inside the running container (via pct exec)
 *   3. `ip -4 -o addr show` inside the container (fallback if hostname is missing)
 *   4. Proxmox API: read the container config's net0 field (picks up DHCP leases
 *      stored in the config after the container has started)
 * Returns the first valid IPv4 address found, or null.
 */
async function resolveContainerIp(
  ipConfig: string,
  ssh: PctExecSession | null,
  client: ProxmoxClient,
  nodeName: string,
  vmid: number,
): Promise<string | null> {
  // 1. Static IP from config (cheapest, no I/O)
  const staticIp = extractIpFromConfig(ipConfig);
  if (staticIp) return staticIp;

  // 2. hostname -I (works on most distros)
  if (ssh) {
    try {
      const r = await ssh.exec("hostname -I 2>/dev/null");
      const ip = r.stdout.trim().split(/\s+/)[0];
      if (ip && IPV4_RE.test(ip)) return ip;
    } catch {
      /* ignore */
    }

    // 3. ip addr (fallback if hostname command is missing)
    try {
      const r = await ssh.exec(
        "ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | head -1",
      );
      const cidr = r.stdout.trim(); // e.g. "10.0.0.50/24"
      const ip = cidr.split("/")[0];
      if (ip && IPV4_RE.test(ip)) return ip;
    } catch {
      /* ignore */
    }
  }

  // 4. Proxmox API — container config net0 field (may reflect DHCP lease)
  try {
    const { extractIpFromNet0 } = await import("../lib/proxmox/utils");
    const configResult = await client.get(
      `/nodes/${nodeName}/lxc/${vmid}/config`,
      z.object({ net0: z.string().optional() }).passthrough(),
    );
    if (configResult.net0) {
      const ip = extractIpFromNet0(configResult.net0);
      if (ip) return ip;
    }
  } catch {
    /* ignore */
  }

  return null;
}

// ============================================================================
// 5-Phase Pipeline
// ============================================================================

async function processContainerCreation(
  job: Job<ContainerJobData, ContainerJobResult>,
): Promise<ContainerJobResult> {
  const {
    containerId,
    nodeName,
    templateId,
    config,
    enabledBuckets,
    additionalPackages,
    scripts: scriptSelections,
  } = job.data;
  let ssh: SSHSession | PctExecSession | null = null;

  try {
    // ========================================================================
    // Phase 1: Create Container (0-20%)
    // ========================================================================

    // Authenticate via env vars (PVE_HOST + PVE_ROOT_PASSWORD)
    const client = await getProxmoxClient();
    const pveNodeName = nodeName;

    await publishProgress(containerId, {
      type: "step",
      step: "creating",
      percent: 5,
      message: "Creating LXC container...",
    });

    // Build features string from config
    const features: string[] = [];
    if (config.nesting) features.push("nesting=1");
    const featuresStr = features.length > 0 ? features.join(",") : undefined;

    const createUpid = await createContainer(client, pveNodeName, {
      vmid: config.vmid,
      ostemplate: config.ostemplate,
      hostname: config.hostname,
      memory: config.memory,
      swap: config.swap,
      cores: config.cores,
      rootfs: `${config.storage}:${config.diskSize}`,
      net0: `name=eth0,bridge=${config.bridge},${config.ipConfig.startsWith("ip=") ? config.ipConfig : `ip=${config.ipConfig}`}`,
      nameserver: config.nameserver,
      password: config.rootPassword,
      "ssh-public-keys": config.sshPublicKey,
      unprivileged: config.unprivileged,
      features: featuresStr,
      storage: config.storage,
      tags: config.tags,
    });

    await waitForTask(client, pveNodeName, createUpid, {
      interval: TASK_POLL_INTERVAL_MS,
      timeout: TASK_TIMEOUT_LONG_MS,
    });

    await publishProgress(containerId, {
      type: "step",
      step: "creating",
      percent: 20,
      message: "Container created successfully",
    });

    // ========================================================================
    // Phase 2: Start Container (20-35%)
    // ========================================================================

    await publishProgress(containerId, {
      type: "step",
      step: "starting",
      percent: 25,
      message: "Starting container...",
    });

    const startUpid = await startContainer(client, pveNodeName, config.vmid);

    await waitForTask(client, pveNodeName, startUpid, {
      interval: TASK_POLL_INTERVAL_MS,
      timeout: TASK_TIMEOUT_MS,
    });

    await publishProgress(containerId, {
      type: "step",
      step: "starting",
      percent: 35,
      message: "Container started",
    });

    // ========================================================================
    // Phase 3: Deploy config-manager and template files via SSH (35-60%)
    // ========================================================================

    // Container IP — resolved later after SSH is connected (needs running container for DHCP).
    let containerIp: string | null = null;

    await publishProgress(containerId, {
      type: "step",
      step: "deploying",
      percent: 40,
      message: "Connecting to Proxmox host...",
    });

    // Connect to the Proxmox host node and use pct exec/push to configure
    // the container. This avoids needing SSH inside the container.
    const pveHost = process.env.PVE_HOST;
    const pveRootPassword = process.env.PVE_ROOT_PASSWORD;

    if (!pveHost) {
      throw new Error("PVE_HOST env var is required for container setup.");
    }

    if (!pveRootPassword) {
      throw new Error(
        "PVE_ROOT_PASSWORD env var is required for container setup via pct exec. " +
          "Set it to the root password of your Proxmox host.",
      );
    }

    const hostSsh = await connectWithRetry({
      host: pveHost,
      username: "root",
      password: pveRootPassword,
    });
    ssh = new PctExecSession(hostSsh, config.vmid);

    await publishProgress(containerId, {
      type: "log",
      message: `Connected to ${pveHost}, using pct exec for CT ${config.vmid}`,
    });

    // Wait for container to be fully ready (systemd initialized)
    // pct push fails if /etc/systemd/system/ doesn't exist yet
    await publishProgress(containerId, {
      type: "log",
      message: "Waiting for container filesystem to be ready...",
    });

    for (
      let attempt = 1;
      attempt <= CONTAINER_FILESYSTEM_READY_MAX_ATTEMPTS;
      attempt++
    ) {
      const check = await ssh.exec(
        "test -d /etc/systemd/system && echo ready || echo not-ready",
      );
      if (check.stdout.trim() === "ready") break;
      if (attempt === CONTAINER_FILESYSTEM_READY_MAX_ATTEMPTS) {
        throw new Error(
          `Container filesystem not ready after ${CONTAINER_FILESYSTEM_READY_MAX_ATTEMPTS} attempts — /etc/systemd/system not found`,
        );
      }
      await new Promise((resolve) =>
        setTimeout(resolve, CONTAINER_FILESYSTEM_CHECK_DELAY_MS),
      );
    }

    await publishProgress(containerId, {
      type: "log",
      message: "Container filesystem ready",
    });

    // Resolve container IP (static from config, or query the running container)
    containerIp = await resolveContainerIp(
      config.ipConfig,
      ssh,
      client,
      pveNodeName,
      config.vmid,
    );
    if (containerIp) {
      await publishProgress(containerId, {
        type: "log",
        message: `Container IP: ${containerIp}`,
      });
    } else {
      await publishProgress(containerId, {
        type: "log",
        message:
          "Warning: could not determine container IP — service URLs will be unavailable",
      });
    }

    // Create credentials directory for service discovery (Phase 5)
    await ssh.exec(`mkdir -p ${CREDENTIALS_DIR}`);

    // Fetch template with scripts, files, packages from DB (if using a template)
    const template = templateId
      ? await prisma.template.findUnique({
          where: { id: templateId },
          include: {
            scripts: { where: { enabled: true }, orderBy: { order: "asc" } },
            files: true,
            packages: true,
          },
        })
      : null;

    if (templateId && !template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Phase 3: Deploy template files
    if (template && template.files.length > 0) {
      for (const file of template.files) {
        // Ensure target directory exists
        await ssh.exec(`mkdir -p "${file.targetPath}"`);
        await ssh.uploadFile(
          file.content,
          `${file.targetPath}/${file.name}`,
          0o644,
        );

        await publishProgress(containerId, {
          type: "log",
          message: `Deployed file: ${file.targetPath}/${file.name}`,
        });
      }
    }

    await publishProgress(containerId, {
      type: "step",
      step: "deploying",
      percent: 60,
      message: "Template files deployed",
    });

    // ========================================================================
    // Phase 4: Install packages and execute template scripts (60-90%)
    // ========================================================================

    await publishProgress(containerId, {
      type: "step",
      step: "syncing",
      percent: 65,
      message: "Running setup...",
    });

    // Install user-selected packages (from wizard enabledBuckets + additionalPackages)
    if ((enabledBuckets && enabledBuckets.length > 0) || additionalPackages) {
      await publishProgress(containerId, {
        type: "log",
        message: "Installing user-selected packages...",
      });

      // Collect packages from template by enabled bucket managers
      const templatePackages =
        template && enabledBuckets
          ? template.packages.filter((p) => enabledBuckets.includes(p.manager))
          : [];

      // Install apt packages
      const aptPackages = templatePackages
        .filter((p) => p.manager === "apt")
        .map((p) => p.name);

      // Append free-text additional packages (one per line, assumed apt)
      if (additionalPackages) {
        const extra = additionalPackages
          .split(/\n/)
          .map((p) => p.trim())
          .filter(Boolean);
        aptPackages.push(...extra);
      }

      if (aptPackages.length > 0) {
        const installCmd = `DEBIAN_FRONTEND=noninteractive apt-get update -qq && apt-get install -y -qq ${aptPackages.join(" ")}`;
        const installExit = await ssh.execStreaming(installCmd, (line) => {
          publishProgress(containerId, {
            type: "log",
            message: line,
          });
        });
        if (installExit !== 0) {
          await publishProgress(containerId, {
            type: "log",
            message: `Package installation exited with code ${installExit} (non-fatal)`,
          });
        }
      }

      // Install pip packages
      const pipPackages = templatePackages
        .filter((p) => p.manager === "pip")
        .map((p) => p.name);

      if (pipPackages.length > 0) {
        const pipCmd = `pip install --quiet ${pipPackages.join(" ")}`;
        const pipExit = await ssh.execStreaming(pipCmd, (line) => {
          publishProgress(containerId, { type: "log", message: line });
        });
        if (pipExit !== 0) {
          await publishProgress(containerId, {
            type: "log",
            message: `pip install exited with code ${pipExit} (non-fatal)`,
          });
        }
      }
    }

    // Filter template scripts by user's wizard selections (if provided)
    const enabledScripts = template
      ? scriptSelections
        ? template.scripts.filter((s) => {
            const selection = scriptSelections.find((sel) => sel.id === s.id);
            return selection ? selection.enabled : s.enabled;
          })
        : template.scripts
      : [];

    // Execute template scripts
    if (enabledScripts.length > 0) {
      const scriptCount = enabledScripts.length;
      const percentPerScript = 25 / scriptCount; // Distribute 65-90% across scripts

      // Upload a shared helpers file once so every script gets log_info,
      // log_warn, log_error and basic env detection (OS, user, pkg manager).
      // Scripts are sourced (not exec'd) so they run in the same bash process
      // that has already sourced these helpers.
      const scriptHelpers = `#!/usr/bin/env bash
# Script helpers — sourced before each template script by the web app worker.
# Provides log_info/log_warn/log_error and basic environment detection.

# Ensure a complete PATH — pct exec starts bash with a minimal environment
# that may not include /usr/local/bin (where Starship, custom tools, etc. land).
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Suppress locale errors and interactive apt prompts for all scripts
export DEBIAN_FRONTEND=noninteractive
export LC_ALL=C

_log() { printf '[%s] [%-7s] %s\\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1" "\${@:2}"; }
log_info()  { _log INFO    "$@"; }
log_warn()  { _log WARNING "$@"; }
log_error() { _log ERROR   "$@"; }

# OS detection
if [[ -f /etc/os-release ]]; then
  CONTAINER_OS="$(. /etc/os-release && echo "\${ID:-unknown}")"
  CONTAINER_OS_VERSION="$(. /etc/os-release && echo "\${VERSION_ID:-unknown}")"
else
  CONTAINER_OS="unknown"
  CONTAINER_OS_VERSION="unknown"
fi
export CONTAINER_OS CONTAINER_OS_VERSION

# Package manager
if command -v apt-get &>/dev/null; then _PKG_MGR="apt"
elif command -v apk &>/dev/null;    then _PKG_MGR="apk"
elif command -v dnf &>/dev/null;    then _PKG_MGR="dnf"
else _PKG_MGR="unknown"; fi
export _PKG_MGR

# Primary non-root user (UID 1000)
CONTAINER_USER="\$(getent passwd 1000 2>/dev/null | cut -d: -f1 || echo '')"
export CONTAINER_USER

# Helper functions available to scripts
is_installed() { command -v "\$1" &>/dev/null; }

# Run a command as the primary container user (CONTAINER_USER, UID 1000).
# Uses sudo -H so that HOME is set to the user's home directory (required by
# NVM, Foundry, and other user-local tools).  Root can always sudo to another
# user without a password, so no sudoers entry is needed beyond the default.
#   Usage: run_as_user <command> [args...]
run_as_user() { sudo -H -u "\${CONTAINER_USER}" -- "\$@"; }

# Lazy apt-get update: runs at most once per script invocation
_apt_updated=false
_apt_update_once() {
  if [[ "\$_apt_updated" == false ]]; then
    apt-get update -qq
    _apt_updated=true
  fi
}

ensure_installed() {
  local pkg="\$1"
  if ! command -v "\$pkg" &>/dev/null; then
    _apt_update_once
    apt-get install -y -qq "\$pkg"
  fi
}

# Wait for apt/dpkg locks to be released (max 60s)
wait_for_apt_lock() {
  local lock_files=( /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/lib/apt/lists/lock )
  local max_wait=60 waited=0
  while true; do
    local locked=false
    for f in "\${lock_files[@]}"; do
      if [[ -f "\$f" ]] && fuser "\$f" &>/dev/null 2>&1; then
        locked=true; break
      fi
    done
    "\$locked" || return 0
    if (( waited >= max_wait )); then
      log_warn "Timed out waiting for apt lock after \${max_wait}s"
      return 1
    fi
    sleep 2; (( waited += 2 )) || true
  done
}

# Generate a random alphanumeric password.
#   Usage: generate_password [length]   (default: 16)
generate_password() {
  local length="\${1:-16}"
  tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "\$length"
}

# Save a credential to /etc/infrahaus/credentials/<service>.
# Each service gets its own file containing JSON key-value pairs.
# The file is root-only (mode 600).
#   Usage: save_credential <service> <KEY> <VALUE>
save_credential() {
  local service="\$1" key="\$2" value="\$3"
  local creds_dir="/etc/infrahaus/credentials"
  local creds_file="\${creds_dir}/\${service}"

  mkdir -p "\$creds_dir"

  # Append or update key in the service file (simple KEY=VALUE format)
  if [[ -f "\$creds_file" ]] && grep -q "^\${key}=" "\$creds_file" 2>/dev/null; then
    sed -i "s|^\${key}=.*|\${key}=\${value}|" "\$creds_file"
  else
    echo "\${key}=\${value}" >> "\$creds_file"
  fi
  chmod 600 "\$creds_file"
}
`;
      await ssh.uploadFile(scriptHelpers, "/tmp/script-helpers.sh", 0o644);

      for (let i = 0; i < enabledScripts.length; i++) {
        const script = enabledScripts[i];
        const scriptPercent = Math.round(65 + (i + 1) * percentPerScript);

        await publishProgress(containerId, {
          type: "log",
          message: `Running script: ${script.name} (${i + 1}/${scriptCount})`,
        });

        // Upload script to /tmp
        const scriptPath = `/tmp/${script.name}`;
        await ssh.uploadFile(script.content, scriptPath, 0o644);

        // Source helpers then source the script in the same bash process so
        // log_info/log_warn/log_error and env vars are available to the script.
        const exitCode = await ssh.execStreaming(
          `bash -c "source /tmp/script-helpers.sh; source '${scriptPath}'"`,
          (line) => {
            publishProgress(containerId, {
              type: "log",
              message: line,
            });
          },
        );

        if (exitCode !== 0) {
          throw new Error(
            `Script "${script.name}" failed with exit code ${exitCode}`,
          );
        }

        // Clean up script
        await ssh.exec(`rm -f "${scriptPath}"`);

        await publishProgress(containerId, {
          type: "step",
          step: "syncing",
          percent: scriptPercent,
          message: `Script "${script.name}" completed`,
        });
      }

      // Clean up helpers
      await ssh.exec("rm -f /tmp/script-helpers.sh");
    }

    await publishProgress(containerId, {
      type: "step",
      step: "syncing",
      percent: 90,
      message: "Setup scripts completed",
    });

    // ========================================================================
    // Phase 5: Service discovery and finalize (90-100%)
    // ========================================================================

    await publishProgress(containerId, {
      type: "step",
      step: "finalizing",
      percent: 92,
      message: "Discovering services...",
    });

    // Phase 5a: Discover services + cache in Redis
    const cache = await discoverAndCacheServices(
      publisher,
      containerId,
      ssh as PctExecSession,
      containerIp,
    );

    for (const svc of cache.services) {
      await publishProgress(containerId, {
        type: "log",
        message: `Discovered service: ${svc.name}${svc.port ? ` (port ${svc.port})` : ""}${svc.credentials ? " [credentials]" : ""}`,
      });
    }

    // Phase 5b: Finalize
    await publishProgress(containerId, {
      type: "step",
      step: "finalizing",
      percent: 98,
      message: "Finalizing container...",
    });

    // Update container lifecycle to ready
    await DatabaseService.updateContainerLifecycle(
      containerId,
      ContainerLifecycle.ready,
    );

    // Close SSH session
    ssh.close();
    ssh = null;

    await publishProgress(containerId, {
      type: "complete",
      percent: 100,
      message: "Container ready!",
    });

    return { success: true, containerId, vmid: config.vmid };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(
      `Container creation failed for ${containerId}:`,
      errorMessage,
    );

    // Update lifecycle to error
    try {
      await DatabaseService.updateContainerLifecycle(
        containerId,
        ContainerLifecycle.error,
      );
    } catch {
      console.error("Failed to update container lifecycle to error");
    }

    // Publish error event
    try {
      await publishProgress(containerId, {
        type: "error",
        message: errorMessage,
      });
    } catch {
      console.error("Failed to publish error progress event");
    }

    return {
      success: false,
      containerId,
      vmid: config.vmid,
      error: errorMessage,
    };
  } finally {
    // Always close SSH connection
    if (ssh) {
      try {
        ssh.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

// ============================================================================
// Worker Instantiation
// ============================================================================

const worker = new Worker<ContainerJobData, ContainerJobResult>(
  CONTAINER_CREATION_QUEUE,
  processContainerCreation,
  {
    connection: workerConnection,
    concurrency: WORKER_CONCURRENCY,
  },
);

worker.on("completed", (job, result) => {
  const config = job.data.config;
  if (result.success) {
    console.log("");
    console.log("========================================");
    console.log("  CONTAINER CREATED SUCCESSFULLY");
    console.log("========================================");
    console.log(`  Hostname:  ${config.hostname}`);
    console.log(`  VMID:      ${config.vmid}`);
    console.log(`  Node:      ${job.data.nodeName}`);
    console.log(`  IP:        ${config.ipConfig}`);
    console.log(`  Storage:   ${config.storage}`);
    console.log("========================================");
    console.log("");
  } else {
    console.error("");
    console.error("========================================");
    console.error("  CONTAINER CREATION FAILED");
    console.error("========================================");
    console.error(`  Hostname:  ${config.hostname}`);
    console.error(`  VMID:      ${config.vmid}`);
    console.error(`  Error:     ${result.error}`);
    console.error("========================================");
    console.error("");
  }
});

worker.on("failed", (job, err) => {
  console.error("");
  console.error("========================================");
  console.error("  JOB FAILED (unhandled)");
  console.error("========================================");
  console.error(`  Job ID:  ${job?.id}`);
  console.error(`  Error:   ${err.message}`);
  console.error("========================================");
  console.error("");
});

// ============================================================================
// Graceful Shutdown
// ============================================================================

async function shutdown() {
  console.log("Shutting down worker...");
  await worker.close();
  await publisher.quit();
  await workerConnection.quit();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// ============================================================================
// Startup
// ============================================================================

console.log("Container creation worker started. Waiting for jobs...");
