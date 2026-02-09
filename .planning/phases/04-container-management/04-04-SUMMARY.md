---
phase: 04-container-management
plan: 04
subsystem: ui
tags:
  [
    next.js,
    shadcn,
    tailwind,
    tabs,
    proxmox,
    auto-refresh,
    alert-dialog,
    ssh,
    monitoring,
    credentials,
  ]

# Dependency graph
requires:
  - phase: 04-container-management
    provides: Lifecycle server actions, DatabaseService query methods, monitoring engine, dashboard data layer, useAutoRefresh hook, StatusBadge component
provides:
  - Container detail page at /containers/[id] with 3-tab interface
  - refreshContainerServicesAction wiring monitoring engine to DB
  - ContainerHeader with full lifecycle action buttons
  - OverviewTab with config grid and live resource bars
  - ServicesTab with refresh, web UI links, per-service credential reveal
  - EventsTab with filter buttons and chronological timeline
  - ContainerDetailData type extended with decrypted credentials
affects: [05-web-ui-monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side credential decryption in getContainerDetailData"
    - "extractIpFromNet0 helper for Proxmox net0 config parsing"
    - "Dynamic import for monitoring engine in server actions"
    - "Per-service credential reveal with copy-to-clipboard"

key-files:
  created:
    - "apps/dashboard/src/app/(dashboard)/containers/[id]/page.tsx"
    - "apps/dashboard/src/app/(dashboard)/containers/[id]/container-detail.tsx"
    - "apps/dashboard/src/components/containers/detail/container-header.tsx"
    - "apps/dashboard/src/components/containers/detail/overview-tab.tsx"
    - "apps/dashboard/src/components/containers/detail/services-tab.tsx"
    - "apps/dashboard/src/components/containers/detail/events-tab.tsx"
  modified:
    - "apps/dashboard/src/lib/containers/actions.ts"
    - "apps/dashboard/src/lib/containers/data.ts"

key-decisions:
  - "Server-side credential decryption via dynamic import of encryption module in getContainerDetailData"
  - "Full lifecycle buttons in header (not dropdown) for direct access to all actions"
  - "Shutdown button added alongside Stop for graceful vs forced stop distinction"
  - "extractIpFromNet0 parses IP from Proxmox net0 config, rejects DHCP/manual"
  - "Dynamic imports for monitoring and encryption modules in refreshContainerServicesAction to avoid circular deps"

patterns-established:
  - "ContainerHeader: full action buttons pattern for detail pages (vs dropdown for cards)"
  - "ResourceBar: reusable progress bar component with color coding at thresholds"
  - "EventRow with expandable metadata: timeline pattern for audit log display"
  - "Server-side credential decryption: decrypt in data layer, pass plain to client"

# Metrics
duration: 6min
completed: 2026-02-09
---

# Phase 4 Plan 4: Container Detail Page Summary

**Container detail page at /containers/[id] with Overview (config + live resources), Services (refresh + credentials + web UI), and Events (filtered timeline) tabs, plus full lifecycle action buttons in header**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-09T07:39:40Z
- **Completed:** 2026-02-09T07:46:25Z
- **Tasks:** 4
- **Files modified:** 8

## Accomplishments

- Built container detail page with server component fetching merged DB + Proxmox data
- Smart routing: creating containers redirect to progress page, missing containers return 404
- Header with full lifecycle action buttons (Start, Shutdown, Stop, Restart, Delete) with AlertDialog for destructive actions
- Overview tab: two-column layout with config grid (hostname, OS, cores, memory, network, features, tags) and live resource bars (CPU, memory, disk with color-coded thresholds)
- Services tab: refresh button triggering SSH-based monitoring via `refreshContainerServicesAction`, per-service credential reveal with copy-to-clipboard, web UI links as outline buttons
- Events tab: filter buttons by type, chronological timeline with color-coded icons, relative timestamps, expandable metadata
- Extended `ContainerDetailData` to include server-side decrypted credentials
- 30s auto-refresh with countdown timer consistent with dashboard

## Task Commits

Each task was committed atomically:

1. **Task 1: refreshContainerServicesAction + detail page server component** - `874059f` (feat)
2. **Task 2: Container header and detail shell** - `d7c20ae` (feat)
3. **Task 3: Overview tab** - `1c5e170` (feat)
4. **Task 4: Services tab and events tab** - `6b2af91` (feat)

## Files Created/Modified

- `apps/dashboard/src/app/(dashboard)/containers/[id]/page.tsx` - Server component with smart routing (creating→progress, missing→404)
- `apps/dashboard/src/app/(dashboard)/containers/[id]/container-detail.tsx` - Client component with tab navigation and auto-refresh
- `apps/dashboard/src/components/containers/detail/container-header.tsx` - Header with lifecycle buttons and AlertDialog confirmations
- `apps/dashboard/src/components/containers/detail/overview-tab.tsx` - Config + resource usage two-column layout
- `apps/dashboard/src/components/containers/detail/services-tab.tsx` - Service cards with refresh, credentials, web UI links
- `apps/dashboard/src/components/containers/detail/events-tab.tsx` - Filtered timeline with type icons and metadata expand
- `apps/dashboard/src/lib/containers/actions.ts` - Added refreshContainerServicesAction and extractIpFromNet0 helper
- `apps/dashboard/src/lib/containers/data.ts` - Extended ContainerDetailData with servicesWithCredentials and server-side decryption

## Decisions Made

- Full lifecycle buttons in header rather than dropdown menu — detail page has space and provides better UX for frequent actions
- Added Shutdown button (graceful) alongside Stop (forceful) to give users clear choice
- Server-side credential decryption in `getContainerDetailData` — credentials decrypted once, passed to client as plain JSON. Avoids client-side crypto complexity.
- Dynamic imports for monitoring.ts and encryption.ts in `refreshContainerServicesAction` to avoid pulling SSH/crypto deps into the action module statically
- `extractIpFromNet0` rejects DHCP/manual — only static IPs supported for monitoring (DHCP discovery deferred)
- ResourceBar color coding: green (<70%), yellow (70-90%), red (>90%) for at-a-glance status

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added server-side credential decryption in data layer**

- **Found during:** Task 4 (Services tab implementation)
- **Issue:** Plan didn't specify how encrypted credentials would be made available to the client. ContainerWithStatus type didn't include credentials.
- **Fix:** Extended ContainerDetailData with `servicesWithCredentials` array containing decrypted credentials. Added server-side decryption in getContainerDetailData using dynamic import of encryption module.
- **Files modified:** apps/dashboard/src/lib/containers/data.ts
- **Verification:** TypeScript compiles, credentials available in ServicesTab
- **Committed in:** 6b2af91 (Task 4 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for credentials feature to work. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 (Container Management) is now complete with all 4 plans executed
- Container dashboard and detail pages fully functional
- Ready for Phase 5 (Web UI & Monitoring) which can build on the service discovery and monitoring infrastructure
- All lifecycle actions, monitoring engine, dashboard, and detail page are integrated end-to-end

---

## Self-Check: PASSED

---

_Phase: 04-container-management_
_Completed: 2026-02-09_
