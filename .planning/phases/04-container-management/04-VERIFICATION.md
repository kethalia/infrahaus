---
phase: 04-container-management
verified: 2026-02-09T08:00:00Z
status: passed
score: 15/15 must-haves verified
must_haves:
  truths:
    - "Server actions can start, stop, shutdown, restart, and delete containers"
    - "Each lifecycle action validates current state, calls Proxmox API, waits for completion, creates ContainerEvent"
    - "Delete action stops running containers before deletion and removes from both Proxmox and DB"
    - "Shutdown falls back to force stop if graceful timeout"
    - "Concurrent lifecycle actions prevented via Redis lock"
    - "Dashboard shows container counts, container cards with status, service dots, resource summary"
    - "Container status reflects live Proxmox status (running/stopped), not just DB lifecycle"
    - "User can filter containers by status"
    - "Auto-refresh every 30s with countdown timer and Refresh Now button"
    - "Container detail page with Overview, Services, Events tabs"
    - "Services tab has refresh button triggering SSH-based monitoring"
    - "Credentials hidden by default, per-service reveal with copy-to-clipboard"
    - "Service monitoring can SSH and check systemd services, discover ports, read credentials"
    - "Proxmox-unreachable warning banner when API fails"
    - "Empty state guides to container creation wizard"
  artifacts:
    - path: "apps/dashboard/src/lib/containers/actions.ts"
      provides: "Lifecycle server actions (start/stop/shutdown/restart/delete) + refreshContainerServicesAction"
    - path: "apps/dashboard/src/lib/containers/data.ts"
      provides: "Server-side data layer merging DB + Proxmox live status"
    - path: "apps/dashboard/src/lib/containers/monitoring.ts"
      provides: "SSH-based service monitoring engine"
    - path: "apps/dashboard/src/lib/containers/helpers.ts"
      provides: "Server-only helper for Proxmox client from session"
    - path: "apps/dashboard/src/lib/containers/schemas.ts"
      provides: "Zod validation schemas for container forms"
    - path: "apps/dashboard/src/app/(dashboard)/page.tsx"
      provides: "Dashboard page with SummaryBar + ContainerGrid"
    - path: "apps/dashboard/src/app/(dashboard)/containers/[id]/page.tsx"
      provides: "Container detail page server component"
    - path: "apps/dashboard/src/app/(dashboard)/containers/[id]/container-detail.tsx"
      provides: "Container detail client component with tabs"
    - path: "apps/dashboard/src/components/containers/summary-bar.tsx"
      provides: "Summary bar with total/running/stopped/error counts"
    - path: "apps/dashboard/src/components/containers/container-grid.tsx"
      provides: "Container grid with filtering, auto-refresh, empty state"
    - path: "apps/dashboard/src/components/containers/container-card.tsx"
      provides: "Individual container card with status, services, resources"
    - path: "apps/dashboard/src/components/containers/container-actions.tsx"
      provides: "Dropdown menu with lifecycle actions + confirmation dialogs"
    - path: "apps/dashboard/src/components/containers/status-badge.tsx"
      provides: "Status badge component for container states"
    - path: "apps/dashboard/src/components/containers/detail/container-header.tsx"
      provides: "Detail page header with all lifecycle action buttons"
    - path: "apps/dashboard/src/components/containers/detail/overview-tab.tsx"
      provides: "Configuration + resource usage cards"
    - path: "apps/dashboard/src/components/containers/detail/services-tab.tsx"
      provides: "Services list with refresh button, credentials reveal, copy-to-clipboard"
    - path: "apps/dashboard/src/components/containers/detail/events-tab.tsx"
      provides: "Event timeline with type filter and metadata expansion"
    - path: "apps/dashboard/src/hooks/use-auto-refresh.ts"
      provides: "Auto-refresh hook with countdown, pause on tab hide, refresh now"
  key_links:
    - from: "container-actions.tsx"
      to: "actions.ts"
      via: "Direct import of startContainerAction, stopContainerAction, etc."
    - from: "page.tsx (dashboard)"
      to: "data.ts"
      via: "getContainersWithStatus() call"
    - from: "services-tab.tsx"
      to: "actions.ts"
      via: "refreshContainerServicesAction call"
    - from: "actions.ts"
      to: "proxmox/containers.ts"
      via: "startContainer, stopContainer, shutdownContainer, deleteContainer, getContainer"
    - from: "actions.ts"
      to: "proxmox/tasks.ts"
      via: "waitForTask for all lifecycle actions"
    - from: "actions.ts"
      to: "monitoring.ts"
      via: "monitorContainer in refreshContainerServicesAction"
    - from: "monitoring.ts"
      to: "ssh.ts"
      via: "connectWithRetry, SSHSession.exec"
---

# Phase 4: Container Management Verification Report

**Phase Goal:** Users can monitor and control container lifecycle with a dashboard overview
**Verified:** 2026-02-09T08:00:00Z
**Status:** ✅ PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                          | Status     | Evidence                                                                                                                                                                                                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Server actions can start, stop, shutdown, restart, and delete containers                                       | ✓ VERIFIED | `actions.ts` exports `startContainerAction`, `stopContainerAction`, `shutdownContainerAction`, `restartContainerAction`, `deleteContainerAction` — all using `authActionClient.schema().action()` pattern (lines 563-782)                                                       |
| 2   | Each lifecycle action validates current state, calls Proxmox API, waits for completion, creates ContainerEvent | ✓ VERIFIED | Each action: (1) calls `getContainer()` to check `status.status`, (2) calls Proxmox lifecycle function returning UPID, (3) calls `waitForTask()`, (4) calls `DatabaseService.createContainerEvent()` with appropriate `EventType`                                               |
| 3   | Delete action stops running containers before deletion and removes from both Proxmox and DB                    | ✓ VERIFIED | `deleteContainerAction` (line 748-782): checks status → stops if running → `deleteContainer(client, nodeName, vmid, true)` with purge → `DatabaseService.deleteContainerById()`                                                                                                 |
| 4   | Shutdown falls back to force stop if graceful timeout                                                          | ✓ VERIFIED | `shutdownContainerAction` (line 650-696): tries `shutdownContainer(client, nodeName, vmid, 30)` with 45s waitForTask timeout → catch block falls back to `stopContainer()`, sets `method = "forced"`                                                                            |
| 5   | Concurrent lifecycle actions prevented via Redis lock                                                          | ✓ VERIFIED | `acquireContainerLock()` uses `redis.set(key, ..., "EX", 120, "NX")` — all 5 lifecycle actions acquire lock at start, release in `finally` block                                                                                                                                |
| 6   | Dashboard shows container counts, container cards with status, service dots, resource summary                  | ✓ VERIFIED | `page.tsx` renders `<SummaryBar>` (total/running/stopped/error counts) + `<ContainerGrid>` → `<ContainerCard>` per container showing hostname, VMID, `<StatusBadge>`, `<ServiceDot>` per service, CPU/Mem resource text                                                         |
| 7   | Container status reflects live Proxmox status (running/stopped), not just DB lifecycle                         | ✓ VERIFIED | `data.ts` `getContainersWithStatus()` fetches Proxmox live status via `listContainers()` on all online nodes, builds `proxmoxStatusMap`, merges in `mergeContainerStatus()` — ready containers get `running`/`stopped` from Proxmox, not from DB                                |
| 8   | User can filter containers by status                                                                           | ✓ VERIFIED | `container-grid.tsx` has `filterOptions` (All/Running/Stopped/Error), `useState<FilterStatus>`, and filters `containers.filter((c) => c.status === filter)` (lines 36-43)                                                                                                       |
| 9   | Auto-refresh every 30s with countdown timer and Refresh Now button                                             | ✓ VERIFIED | `use-auto-refresh.ts` hook: `intervalSeconds = 30`, countdown decrement every 1s, `router.refresh()` on countdown zero, pauses on `visibilityState === "hidden"`, `refreshNow` callback. Used in both `container-grid.tsx` and `container-detail.tsx` with "Refresh Now" button |
| 10  | Container detail page with Overview, Services, Events tabs                                                     | ✓ VERIFIED | `container-detail.tsx` renders `<Tabs>` with `<TabsTrigger value="overview">`, `<TabsTrigger value="services">`, `<TabsTrigger value="events">` mapping to `<OverviewTab>`, `<ServicesTab>`, `<EventsTab>`                                                                      |
| 11  | Services tab has refresh button triggering SSH-based monitoring                                                | ✓ VERIFIED | `services-tab.tsx` has "Refresh" button calling `refreshContainerServicesAction` → `actions.ts` validates container, gets IP from Proxmox config, decrypts password → calls `monitorContainer()` from `monitoring.ts` → SSH connects and runs checks → updates DB               |
| 12  | Credentials hidden by default, per-service reveal with copy-to-clipboard                                       | ✓ VERIFIED | `services-tab.tsx` `ServiceCard`: `showCredentials` state defaults to `false`, "Show/Hide Credentials" toggle with Eye/EyeOff icons, `copyToClipboard()` with `navigator.clipboard.writeText()` and green checkmark feedback                                                    |
| 13  | Service monitoring can SSH and check systemd services, discover ports, read credentials                        | ✓ VERIFIED | `monitoring.ts` (420 lines): `monitorContainer()` orchestrates `checkSystemdServices()` (systemctl show), `discoverPorts()` (ss -tlnp), `readCredentials()` (/etc/infrahaus/credentials/), `checkConfigManagerStatus()` — all via SSH in parallel                               |
| 14  | Proxmox-unreachable warning banner when API fails                                                              | ✓ VERIFIED | `data.ts` sets `proxmoxReachable = false` on catch. `container-grid.tsx` renders `<Alert variant="destructive">` with WifiOff icon. `container-detail.tsx` renders similar alert. Both check `!proxmoxReachable`                                                                |
| 15  | Empty state guides to container creation wizard                                                                | ✓ VERIFIED | `container-grid.tsx` `EmptyState` component: shows "No containers yet" + "Create your first container to get started" + `<Button asChild><Link href="/containers/new">Create Container</Link></Button>`                                                                         |

**Score:** 15/15 truths verified

### Required Artifacts

| Artifact                                                                  | Expected                 | Status     | Details                                                                                                                                  |
| ------------------------------------------------------------------------- | ------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/dashboard/src/lib/containers/actions.ts`                            | Lifecycle server actions | ✓ VERIFIED | 947 lines, exports 7 server actions (create + 5 lifecycle + refreshServices), all using authActionClient                                 |
| `apps/dashboard/src/lib/containers/data.ts`                               | Server-only data layer   | ✓ VERIFIED | 370 lines, `server-only` import, exports `getContainersWithStatus()` + `getContainerDetailData()`, merges Proxmox live status            |
| `apps/dashboard/src/lib/containers/monitoring.ts`                         | SSH monitoring engine    | ✓ VERIFIED | 420 lines, exports `monitorContainer()` + individual check functions, handles SSH failures gracefully                                    |
| `apps/dashboard/src/lib/containers/helpers.ts`                            | Proxmox client helper    | ✓ VERIFIED | 52 lines, `server-only`, `createProxmoxClientFromSession()`                                                                              |
| `apps/dashboard/src/lib/containers/schemas.ts`                            | Zod schemas              | ✓ VERIFIED | 172 lines, shared between server + client                                                                                                |
| `apps/dashboard/src/app/(dashboard)/page.tsx`                             | Dashboard page           | ✓ VERIFIED | 31 lines, fetches data via `getContainersWithStatus()`, renders SummaryBar + ContainerGrid                                               |
| `apps/dashboard/src/app/(dashboard)/containers/[id]/page.tsx`             | Detail page route        | ✓ VERIFIED | 32 lines, fetches via `getContainerDetailData()`, redirects creating to progress, passes data to ContainerDetail                         |
| `apps/dashboard/src/app/(dashboard)/containers/[id]/container-detail.tsx` | Detail client component  | ✓ VERIFIED | 111 lines, client component with auto-refresh, Proxmox warning, Tabs (Overview/Services/Events)                                          |
| `apps/dashboard/src/components/containers/summary-bar.tsx`                | Summary bar              | ✓ VERIFIED | 92 lines, 4-column grid with total/running/stopped/error counts                                                                          |
| `apps/dashboard/src/components/containers/container-grid.tsx`             | Container grid           | ✓ VERIFIED | 154 lines, client component with filter state, auto-refresh, empty state handling                                                        |
| `apps/dashboard/src/components/containers/container-card.tsx`             | Container card           | ✓ VERIFIED | 122 lines, shows hostname, VMID, StatusBadge, ServiceDots, resource text, links to detail                                                |
| `apps/dashboard/src/components/containers/container-actions.tsx`          | Action dropdown          | ✓ VERIFIED | 218 lines, DropdownMenu with Start/Stop/Restart/Delete, confirmation dialogs, toast notifications                                        |
| `apps/dashboard/src/components/containers/status-badge.tsx`               | Status badge             | ✓ VERIFIED | 59 lines, 5 statuses (running/stopped/creating/error/unknown) with colored dots                                                          |
| `apps/dashboard/src/components/containers/detail/container-header.tsx`    | Detail header            | ✓ VERIFIED | 274 lines, back link, title with StatusBadge, Start/Shutdown/Stop/Restart/Delete buttons with confirmations                              |
| `apps/dashboard/src/components/containers/detail/overview-tab.tsx`        | Overview tab             | ✓ VERIFIED | 421 lines, Configuration card (hostname, VMID, cores, memory, network, features, tags) + Resource Usage card with ResourceBar components |
| `apps/dashboard/src/components/containers/detail/services-tab.tsx`        | Services tab             | ✓ VERIFIED | 261 lines, Refresh button → `refreshContainerServicesAction`, ServiceCard with hidden credentials + copy-to-clipboard                    |
| `apps/dashboard/src/components/containers/detail/events-tab.tsx`          | Events tab               | ✓ VERIFIED | 275 lines, event type filter buttons, timeline with EventRow, metadata expansion                                                         |
| `apps/dashboard/src/hooks/use-auto-refresh.ts`                            | Auto-refresh hook        | ✓ VERIFIED | 111 lines, 30s countdown, visibility-aware pausing, `router.refresh()`, refreshNow                                                       |

### Key Link Verification

| From                   | To                    | Via                   | Status  | Details                                                                                                                                      |
| ---------------------- | --------------------- | --------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| container-actions.tsx  | actions.ts            | Direct import         | ✓ WIRED | Imports `startContainerAction`, `stopContainerAction`, `restartContainerAction`, `deleteContainerAction` — all called in handlers            |
| container-header.tsx   | actions.ts            | Direct import         | ✓ WIRED | Imports all 5 lifecycle actions including `shutdownContainerAction`, called via `handleAction()` helper                                      |
| services-tab.tsx       | actions.ts            | Direct import         | ✓ WIRED | Imports `refreshContainerServicesAction`, called in `handleRefresh()`                                                                        |
| page.tsx (dashboard)   | data.ts               | Function call         | ✓ WIRED | Calls `getContainersWithStatus()`, destructures `containers`, `counts`, `proxmoxReachable`, passes to components                             |
| page.tsx (detail)      | data.ts               | Function call         | ✓ WIRED | Calls `getContainerDetailData(id)`, passes result to `<ContainerDetail>`                                                                     |
| actions.ts (lifecycle) | proxmox/containers.ts | Import + call         | ✓ WIRED | Imports `startContainer`, `stopContainer`, `shutdownContainer`, `deleteContainer`, `getContainer` — all called with client + nodeName + vmid |
| actions.ts (lifecycle) | proxmox/tasks.ts      | Import + call         | ✓ WIRED | `waitForTask(client, nodeName, upid, { timeout })` called after every Proxmox action                                                         |
| actions.ts (lifecycle) | db.ts                 | Import + call         | ✓ WIRED | `DatabaseService.createContainerEvent()` called in all actions, `DatabaseService.deleteContainerById()` in delete                            |
| actions.ts (lifecycle) | redis.ts              | Import + call         | ✓ WIRED | `getRedis()` called in `acquireContainerLock()` and `releaseContainerLock()` — SET NX EX / DEL pattern                                       |
| actions.ts (refresh)   | monitoring.ts         | Dynamic import + call | ✓ WIRED | `monitorContainer()` called with containerId, IP, password, serviceNames                                                                     |
| monitoring.ts          | ssh.ts                | Import + call         | ✓ WIRED | `connectWithRetry()` for SSH connection, `ssh.exec()` for all commands                                                                       |
| data.ts                | proxmox/containers.ts | Import + call         | ✓ WIRED | `listContainers()`, `getContainer()`, `getContainerConfig()` all called with live Proxmox client                                             |
| container-grid.tsx     | use-auto-refresh.ts   | Import + hook         | ✓ WIRED | `useAutoRefresh({ intervalSeconds: 30 })` — countdown, isPaused, refreshNow, isRefreshing all used in JSX                                    |

### Requirements Coverage

All requirements for Phase 4 are satisfied via the verified truths above. The phase goal "Users can monitor and control container lifecycle with a dashboard overview" is fully achieved.

### Anti-Patterns Found

| File       | Line    | Pattern                                                      | Severity | Impact                                                                                 |
| ---------- | ------- | ------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------- |
| actions.ts | 141-142 | "placeholder token" comment + `encrypt("env-auth-no-token")` | ℹ️ Info  | Intentional — DB record for env-based auth node, not a stub. Comment explains purpose. |

No blocker or warning anti-patterns found. No TODO/FIXME comments in Phase 4 files. No empty return stubs. No placeholder UI content.

### Human Verification Required

### 1. Dashboard Visual Layout

**Test:** Navigate to `/` with containers in various states (running, stopped, error, creating)
**Expected:** Summary bar shows correct counts, container cards show status badges with colored dots, service dots display correctly, resource text shows CPU/Memory for running containers
**Why human:** Visual layout verification — grid responsiveness, color accuracy, typography

### 2. Lifecycle Action Round-Trip

**Test:** From dashboard or detail page, start a stopped container, then stop it, then restart it
**Expected:** Toast notifications for success/failure, UI updates after action completes (via revalidatePath), button states change (Start shown when stopped, Stop/Shutdown/Restart when running)
**Why human:** Requires running Proxmox instance and real container to test API round-trip

### 3. Delete Confirmation Flow

**Test:** Click Delete on a running container
**Expected:** Confirmation dialog appears with container name and VMID, action stops container first then deletes, redirects to dashboard after deletion
**Why human:** Requires real container + visual confirmation dialog UX

### 4. Auto-Refresh Behavior

**Test:** Sit on dashboard, observe countdown from 30 → 0, switch tabs and return
**Expected:** Countdown decrements every second, shows "Paused" when tab hidden, immediate refresh on tab focus, "Refresh Now" button triggers instant refresh with spinner
**Why human:** Real-time behavior + tab visibility API

### 5. Service Refresh via SSH

**Test:** Navigate to a running container's detail page → Services tab → click Refresh
**Expected:** SSH connects to container, discovers running services + ports, credentials appear in service cards (hidden by default), can reveal and copy credentials
**Why human:** Requires running container with SSH access, services installed, credentials in /etc/infrahaus/credentials/

### 6. Proxmox Unreachable State

**Test:** Disconnect Proxmox or use invalid PVE_HOST, load dashboard
**Expected:** Yellow/red warning banner "Unable to reach Proxmox API...", containers show "unknown" status
**Why human:** Requires simulating network failure to Proxmox

### Gaps Summary

No gaps found. All 15 must-haves verified at all three levels (existence, substantive, wired):

- **Lifecycle server actions**: All 5 actions (start/stop/shutdown/restart/delete) implemented with proper state validation, Proxmox API calls, task waiting, audit events, and Redis locking.
- **Service monitoring**: Complete SSH-based engine with systemd checks, port discovery, credential reading, and config-manager status.
- **Dashboard**: Full implementation with summary bar, container cards, status filtering, auto-refresh with countdown, Proxmox-unreachable warning, and empty state.
- **Detail page**: Three-tab layout (Overview/Services/Events) with all lifecycle actions in header, service refresh, credential reveal/copy, event timeline with metadata.
- **Data layer**: Server-only data module properly merging DB lifecycle with Proxmox live status for accurate running/stopped display.

---

_Verified: 2026-02-09T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
