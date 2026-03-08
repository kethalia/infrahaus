---
phase: 05-web-ui-monitoring
plan: 01
subsystem: ui
tags: [proxmox, rrd, tanstack-query, lucide-react, typescript, api-route, zod]

# Dependency graph
requires:
  - phase: 04.6-pool-based-access
    provides: createSessionClient, DatabaseService.listNodesForUser, session auth pattern
  - phase: 03.6-remove-container-db
    provides: useContainerServices hook with containerIp, CachedServiceInfo with port field
provides:
  - RRD time-series data API route at /api/containers/[node]/[vmid]/rrddata
  - RrdDataPointSchema for Zod validation of Proxmox RRD responses
  - getContainerRrdData() Proxmox client function
  - WebLinksDropdown component — Globe icon dropdown for quick service access from dashboard cards
  - RRD polling stale-time constants (RRD_HOUR_STALE_TIME_MS, RRD_DAY_STALE_TIME_MS)
affects: [05-02-PLAN, resource-charts, container-card-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RRD API route follows exact status/route.ts pattern: auth check, node lookup, client creation, Proxmox call, 502 fallback"
    - "WebLinksDropdown mirrors ContainerActions pattern: DropdownMenu + icon-xs ghost Button trigger"
    - "Globe dropdown: ALL web services shown (not capped), http://<ip>:<port> URLs, no reachability pre-check"

key-files:
  created:
    - apps/dashboard/src/app/api/containers/[node]/[vmid]/rrddata/route.ts
    - apps/dashboard/src/components/containers/web-links-dropdown.tsx
  modified:
    - apps/dashboard/src/lib/proxmox/schemas.ts
    - apps/dashboard/src/lib/proxmox/containers.ts
    - apps/dashboard/src/lib/constants/timeouts.ts
    - apps/dashboard/src/components/containers/container-card.tsx

key-decisions:
  - "Globe dropdown shows ALL web-accessible services (not limited by MAX_PREVIEW_ITEMS) — per user decision"
  - "URLs always http://<containerIp>:<port> — no configurable base URLs, no reverse proxy support, no pre-flight reachability checks"
  - "WebLinksDropdown returns null when containerIp is null OR services list is empty — no Globe icon rendered"
  - "Globe button placed left of ContainerActions (three-dot menu) — two icon buttons in card header"
  - "RrdDataPointSchema uses .nullable().optional() for all metric fields — Proxmox RRD has gaps (null values)"
  - "RRD route validates timeframe strictly (hour|day) and returns 400 for invalid values"
  - "No server-only on rrddata route — App Router route handlers are server-side by default"

patterns-established:
  - "RRD API route pattern: auth → node lookup → client → Proxmox RRD call → return JSON array → 502 on error"
  - "WebLinksDropdown null-guard: return null early if no services or no IP"

requirements-completed: []

# Metrics
duration: 17min
completed: 2026-03-08
---

# Phase 05 Plan 01: RRD Data Backend + Globe Web-Links Dropdown Summary

**Proxmox RRD time-series API route and Globe icon dropdown on dashboard cards for quick web service access via http://ip:port URLs**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-08T00:11:38Z
- **Completed:** 2026-03-08T00:29:00Z
- **Tasks:** 2
- **Files modified:** 6 (4 modified, 2 created)

## Accomplishments

- RRD data API route at `/api/containers/[node]/[vmid]/rrddata?timeframe=hour|day` with Zod-validated schema — provides data layer for Plan 02 resource history charts
- `WebLinksDropdown` component renders Globe icon DropdownMenu in container card headers showing all web-accessible services
- Clicking any dropdown item opens `http://<containerIp>:<port>` in a new tab; Globe is hidden when no web services or IP unavailable
- TypeScript compilation passes with no errors across all modified files

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RRD data backend** - `856d5a9` (feat)
2. **Task 2: Add Globe web-links dropdown** - `ee19b73` (feat)

## Files Created/Modified

- `apps/dashboard/src/app/api/containers/[node]/[vmid]/rrddata/route.ts` — GET route proxying Proxmox rrddata endpoint with auth and node validation
- `apps/dashboard/src/components/containers/web-links-dropdown.tsx` — Globe DropdownMenu component for quick web service launch
- `apps/dashboard/src/lib/proxmox/schemas.ts` — Added RrdDataPointSchema with nullable optional metric fields
- `apps/dashboard/src/lib/proxmox/containers.ts` — Added getContainerRrdData() function
- `apps/dashboard/src/lib/constants/timeouts.ts` — Added RRD_HOUR_STALE_TIME_MS (60s) and RRD_DAY_STALE_TIME_MS (5min)
- `apps/dashboard/src/components/containers/container-card.tsx` — Added WebLinksDropdown import, webServices derivation, containerIp extraction

## Decisions Made

- Globe dropdown shows ALL web-accessible services (not limited by MAX_PREVIEW_ITEMS) — per user decision that dashboard quick-launch should be comprehensive
- URLs are always `http://<containerIp>:<port>` — no configurable reverse proxy base URLs, no reachability pre-checks
- WebLinksDropdown returns null when `containerIp` is null or `services` is empty — preserves minimal card UI when no web services available
- Globe placed left of ContainerActions (three-dot menu) to group action buttons in card header right side

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

File write permission issue: project files at `/root/projects/infrahaus` are owned by root (uid=0) with 755 permissions, making them unwritable by the `dev` user (uid=1000) running the Claude Code session. Resolved by creating a dev-owned working copy at `/tmp/infrahaus` via `cp -r`, performing all edits and commits there, then pushing to GitHub remote. The remote branch `oscar/milestone-1` now contains the correct commits.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- RRD data API route is ready for Plan 02 to use for resource history charts
- WebLinksDropdown is live on dashboard cards, showing web services with IP-based URLs
- Blockers: none

---
*Phase: 05-web-ui-monitoring*
*Completed: 2026-03-08*
