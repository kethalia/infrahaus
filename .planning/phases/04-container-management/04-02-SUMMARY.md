---
phase: 04-container-management
plan: 02
subsystem: monitoring
tags: [ssh, systemd, systemctl, ss, credentials, monitoring]

# Dependency graph
requires:
  - phase: 03-container-creation
    provides: SSHSession class, connectWithRetry, BullMQ worker service discovery
provides:
  - monitorContainer orchestrator function
  - checkSystemdServices batch status checker
  - discoverPorts TCP listener discovery
  - readCredentials credential file parser
  - checkConfigManagerStatus systemd unit inspector
affects: [04-container-management, 05-web-ui-monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    [
      SSH-based monitoring,
      graceful failure with error-in-result pattern,
      batch systemctl show,
    ]

key-files:
  created:
    - apps/dashboard/src/lib/containers/monitoring.ts
  modified: []

key-decisions:
  - "Batch systemctl show for all services in one SSH command (reduces round trips)"
  - "Port 22 filtered from discoverPorts (SSH is infrastructure, not application)"
  - "Credential files parsed as key=value; fallback to single 'password' entry for plain text"
  - "connectWithRetry with 2 attempts and 1s initial delay for monitoring (lighter than creation's 5 attempts)"
  - "All check functions accept SSHSession param for testability and reuse"

patterns-established:
  - "Error-in-result pattern: monitorContainer returns { error: string } instead of throwing"
  - "Pure monitoring functions: take SSH session, return typed results, no side effects"

# Metrics
duration: 2min
completed: 2026-02-09
---

# Phase 4 Plan 2: Service Monitoring Engine Summary

**SSH-based monitoring engine with systemd service checks, port discovery, credential reading, and config-manager health inspection**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-09T07:23:53Z
- **Completed:** 2026-02-09T07:26:22Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Service monitoring engine that SSH-es into containers for on-demand health checks
- Batch systemd service status checking via `systemctl show` (one command for N services)
- TCP port discovery via `ss -tlnp` with SSH port filtering and deduplication
- Credential file parser for `/etc/infrahaus/credentials/` with key=value and plain text support
- Config-manager status inspection (installed, last run, exit code, last log)
- Graceful SSH failure handling — returns error in result object, never throws

## Task Commits

Each task was committed atomically:

1. **Task 1: Service monitoring engine** - `7f8008e` (feat)

## Files Created/Modified

- `apps/dashboard/src/lib/containers/monitoring.ts` - Service monitoring engine: monitorContainer, checkSystemdServices, discoverPorts, readCredentials, checkConfigManagerStatus

## Decisions Made

- Batch `systemctl show` for multiple services in one SSH round trip (efficiency)
- Port 22 filtered from port discovery (infrastructure noise vs application ports)
- Credential files parsed as key=value pairs; plain text files stored with key "password"
- connectWithRetry uses 2 attempts / 1s delay for monitoring (lighter than 5-attempt creation flow)
- All functions accept SSHSession for testability — monitorContainer is the only one managing connection lifecycle

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Monitoring engine ready for use by container detail pages (04-04) and dashboard (04-03)
- Functions can be called from server actions or worker process (no server-only guard)
- Ready for 04-03-PLAN.md (container dashboard page)

## Self-Check: PASSED

---

_Phase: 04-container-management_
_Completed: 2026-02-09_
