---
phase: 04-container-management
plan: 01
subsystem: api
tags: [proxmox, server-actions, redis, lifecycle, prisma, next-safe-action]

# Dependency graph
requires:
  - phase: 03-container-creation
    provides: DatabaseService container CRUD, ProxmoxClient, container model, BullMQ worker
provides:
  - createProxmoxClientFromSession helper for session-based Proxmox access
  - 5 lifecycle server actions (start/stop/shutdown/restart/delete)
  - DatabaseService query methods for dashboard and detail pages
  - Redis lock pattern for concurrent operation prevention
affects: [04-02, 04-03, 04-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Redis NX+EX lock for concurrent container operation prevention"
    - "Graceful shutdown with force-stop fallback"
    - "getContainerContext helper for action boilerplate reduction"

key-files:
  created:
    - "apps/dashboard/src/lib/containers/helpers.ts"
  modified:
    - "apps/dashboard/src/lib/containers/actions.ts"
    - "apps/dashboard/src/lib/db.ts"

key-decisions:
  - "Used getProxmoxClient() (env-based) for actions matching existing codebase pattern; createProxmoxClientFromSession ready for multi-user auth"
  - "Redis lock with 120s TTL prevents concurrent lifecycle actions on same container"
  - "Shutdown graceful timeout at 30s before force-stop fallback"
  - "Delete uses purge=true to clean all Proxmox data"

patterns-established:
  - "acquireContainerLock/releaseContainerLock: Redis NX+EX pattern for operation serialization"
  - "getContainerContext: shared helper to resolve container DB record + Proxmox client + node name"

# Metrics
duration: 4min
completed: 2026-02-09
---

# Phase 4 Plan 1: Container Lifecycle Actions Summary

**5 lifecycle server actions (start/stop/shutdown/restart/delete) with Redis lock concurrency prevention, ProxmoxClient-from-session helper, and 7 new DatabaseService query methods for Wave 2 UI**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-09T07:23:31Z
- **Completed:** 2026-02-09T07:27:53Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `createProxmoxClientFromSession` helper encapsulating session-to-client pattern
- Extended DatabaseService with 5 new query methods: `listContainersWithRelations`, `getContainerCounts`, `getContainerWithDetails`, `deleteContainerById`, `updateContainerServices`
- Added 5 lifecycle server actions using `authActionClient.schema(containerIdSchema).action()` pattern
- Implemented Redis NX+EX lock preventing concurrent lifecycle operations on same container
- Shutdown action gracefully falls back to force stop after 30s timeout
- Delete action stops running containers before removing from both Proxmox (with purge) and database

## Task Commits

Each task was committed atomically:

1. **Task 1: ProxmoxClient-from-session helper and DatabaseService query methods** - `c2904b6` (feat)
2. **Task 2: Container lifecycle server actions** - `02de538` (feat)

## Files Created/Modified

- `apps/dashboard/src/lib/containers/helpers.ts` - ProxmoxClient-from-session helper with server-only guard
- `apps/dashboard/src/lib/containers/actions.ts` - 5 lifecycle server actions with Redis lock and state validation
- `apps/dashboard/src/lib/db.ts` - DatabaseService extended with container query methods and new derived types

## Decisions Made

- Used `getProxmoxClient()` (env-based auth) in lifecycle actions for consistency with existing `createContainerAction`; `createProxmoxClientFromSession` is exported and ready for Phase 03.5 multi-user auth migration
- Redis lock TTL set to 120s — long enough for slow operations, short enough to auto-recover from stuck locks
- Shutdown graceful timeout at 30s; if exceeded, falls back to force stop rather than failing
- Delete uses `purge=true` flag on Proxmox API to clean all container data (volumes, configs)
- `getContainerContext` helper extracts common pattern of resolving container → node → client

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 lifecycle actions ready for Wave 2 UI consumption (04-03 dashboard, 04-04 detail page)
- DatabaseService query methods ready for dashboard (listContainersWithRelations, getContainerCounts) and detail page (getContainerWithDetails)
- `updateContainerServices` ready for 04-02 service monitoring engine
- `createProxmoxClientFromSession` ready for Phase 03.5 multi-user auth migration

---

## Self-Check: PASSED

---

_Phase: 04-container-management_
_Completed: 2026-02-09_
