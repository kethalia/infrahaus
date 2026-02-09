---
phase: 04-container-management
plan: 03
subsystem: ui
tags:
  [
    next.js,
    shadcn,
    tailwind,
    proxmox,
    dashboard,
    auto-refresh,
    dropdown-menu,
    alert-dialog,
  ]

# Dependency graph
requires:
  - phase: 04-container-management
    provides: Lifecycle server actions (start/stop/restart/delete), DatabaseService query methods (listContainersWithRelations, getContainerCounts, getContainerWithDetails)
provides:
  - Container dashboard page with summary bar, container grid, and auto-refresh
  - getContainersWithStatus data layer merging DB + Proxmox live status
  - getContainerDetailData for detail page (04-04)
  - ContainerWithStatus, DashboardData, ContainerDetailData types
  - useAutoRefresh hook for reuse by detail page
  - StatusBadge, ContainerActions, ContainerCard atomic components
  - ContainerGrid with filter controls and empty state
  - SummaryBar with 4 stat cards
affects: [04-04]

# Tech tracking
tech-stack:
  added: ["@radix-ui/react-dropdown-menu"]
  patterns:
    - "Server component data fetching with getContainersWithStatus for merged DB + Proxmox data"
    - "useAutoRefresh hook with router.refresh(), visibilitychange, countdown timer"
    - "Status filter pills pattern for container grid"

key-files:
  created:
    - "apps/dashboard/src/lib/containers/data.ts"
    - "apps/dashboard/src/components/containers/status-badge.tsx"
    - "apps/dashboard/src/components/containers/container-actions.tsx"
    - "apps/dashboard/src/components/containers/container-card.tsx"
    - "apps/dashboard/src/components/containers/container-grid.tsx"
    - "apps/dashboard/src/components/containers/summary-bar.tsx"
    - "apps/dashboard/src/hooks/use-auto-refresh.ts"
    - "apps/dashboard/src/components/ui/dropdown-menu.tsx"
    - "apps/dashboard/src/app/(dashboard)/containers/page.tsx"
  modified:
    - "apps/dashboard/src/app/(dashboard)/page.tsx"

key-decisions:
  - "getContainersWithStatus fetches all node containers in parallel then builds VMID→status map for O(1) lookup"
  - "StatusBadge uses custom color classes (emerald/gray/blue/red/yellow) with outline variant for distinct visual identity"
  - "ContainerActions uses useTransition for non-blocking action calls with toast feedback"
  - "SummaryBar receives live running/stopped counts from parent rather than computing from DB lifecycle counts"
  - "useAutoRefresh uses router.refresh() to re-fetch server components without full page reload"
  - "Created shadcn dropdown-menu component manually since npx shadcn add failed in containerized environment"

patterns-established:
  - "mergeContainerStatus: creating→creating, error→error, ready+proxmox→running/stopped, ready+no-proxmox→unknown"
  - "useAutoRefresh: generic hook with countdown, pause on hidden, immediate refresh on focus"
  - "Container filter pills: Button with variant toggle (default/outline) for active filter state"

# Metrics
duration: 5min
completed: 2026-02-09
---

# Phase 4 Plan 3: Container Dashboard Page Summary

**Dashboard page with summary bar (4 stat cards), responsive container grid with status filters, auto-refresh (30s countdown + visibilitychange), lifecycle actions via dropdown menu with AlertDialog, and Proxmox-unreachable warning banner**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-09T07:30:55Z
- **Completed:** 2026-02-09T07:36:32Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- Created server-only data layer (`data.ts`) merging DB container records with live Proxmox status for dashboard and detail pages
- Built 4 atomic UI components: StatusBadge, ContainerActions (with AlertDialog for stop/delete), ContainerCard (hostname, VMID, service dots, resource summary), SummaryBar
- Built ContainerGrid with status filter pills, Proxmox-unreachable warning banner, and empty state linking to creation wizard
- Implemented useAutoRefresh hook with 30s countdown, Refresh Now button, and visibilitychange pause/resume
- Replaced placeholder dashboard page with full server-component implementation fetching merged data

## Task Commits

Each task was committed atomically:

1. **Task 1: Container data fetching with Proxmox status sync** - `12a2349` (feat)
2. **Task 2: Atomic UI components (status-badge, container-actions, container-card)** - `6489a0d` (feat)
3. **Task 3: Composition components and dashboard page** - `2dcf84c` (feat)

## Files Created/Modified

- `apps/dashboard/src/lib/containers/data.ts` - Server-only data layer with getContainersWithStatus and getContainerDetailData
- `apps/dashboard/src/components/containers/status-badge.tsx` - Color-coded status badge (running/stopped/creating/error/unknown)
- `apps/dashboard/src/components/containers/container-actions.tsx` - DropdownMenu with lifecycle actions and AlertDialog confirmations
- `apps/dashboard/src/components/containers/container-card.tsx` - Container card with hostname, VMID, services, resources
- `apps/dashboard/src/components/containers/container-grid.tsx` - Grid with filter pills, auto-refresh controls, empty state
- `apps/dashboard/src/components/containers/summary-bar.tsx` - 4 stat cards (total, running, stopped, error)
- `apps/dashboard/src/hooks/use-auto-refresh.ts` - Auto-refresh hook with countdown, pause/resume, refreshNow
- `apps/dashboard/src/components/ui/dropdown-menu.tsx` - shadcn dropdown-menu component
- `apps/dashboard/src/app/(dashboard)/page.tsx` - Dashboard page with server-side data fetching
- `apps/dashboard/src/app/(dashboard)/containers/page.tsx` - Redirect to / (dashboard)

## Decisions Made

- getContainersWithStatus fetches all containers from all online Proxmox nodes in parallel, then builds a VMID→status map for efficient lookup
- SummaryBar receives pre-computed running/stopped counts from the parent page (computed from merged Proxmox data) rather than deriving from DB lifecycle counts
- ContainerActions uses `useTransition` for non-blocking server action calls instead of `useAction` (simpler for one-shot calls, no form needed)
- useAutoRefresh uses `router.refresh()` which re-fetches server components without full page navigation
- Created dropdown-menu shadcn component manually using `@radix-ui/react-dropdown-menu` since `npx shadcn@latest add` failed in the containerized Coder environment (npm/husky conflict)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created shadcn dropdown-menu component manually**

- **Found during:** Task 2 (component creation)
- **Issue:** `npx shadcn@latest add dropdown-menu` failed due to npm/husky conflict in containerized environment
- **Fix:** Installed `@radix-ui/react-dropdown-menu` via pnpm, created the shadcn dropdown-menu.tsx component manually following the official shadcn pattern
- **Files modified:** apps/dashboard/src/components/ui/dropdown-menu.tsx, package.json, pnpm-lock.yaml
- **Verification:** TypeScript compilation passes
- **Committed in:** 6489a0d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor tooling workaround. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Dashboard page fully functional with summary bar, container grid, and auto-refresh
- `getContainerDetailData` exported and ready for 04-04 (container detail page)
- `useAutoRefresh` hook exported and reusable for detail page
- All atomic components (StatusBadge, ContainerActions, ContainerCard) reusable across pages

---

## Self-Check: PASSED

---

_Phase: 04-container-management_
_Completed: 2026-02-09_
