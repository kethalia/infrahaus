---
phase: 05-web-ui-monitoring
plan: 01
subsystem: monitoring-ui
tags: [proxmox, rrd, api-route, dropdown, web-links, dashboard]

dependency-graph:
  requires: [04-container-management]
  provides: [rrd-data-api, web-links-dropdown]
  affects: [05-02]

tech-stack:
  added: []
  patterns: [proxmox-rrd-proxy-route, conditional-dropdown-rendering]

key-files:
  created:
    - apps/dashboard/src/app/api/containers/[node]/[vmid]/rrddata/route.ts
    - apps/dashboard/src/components/containers/web-links-dropdown.tsx
  modified:
    - apps/dashboard/src/lib/proxmox/schemas.ts
    - apps/dashboard/src/lib/proxmox/containers.ts
    - apps/dashboard/src/lib/constants/timeouts.ts
    - apps/dashboard/src/components/containers/container-card.tsx

decisions:
  - RRD data fields (cpu, mem, disk, netin, netout) are nullable().optional() because Proxmox RRD may have gaps
  - Globe dropdown shows ALL web-accessible services (not limited to MAX_PREVIEW_ITEMS)
  - URLs constructed as http://<container-ip>:<port> — no reverse proxy support, no pre-flight reachability checks
  - WebLinksDropdown returns null when no services or no IP — no Globe icon rendered
  - Globe icon placed before ContainerActions three-dot menu in card header

metrics:
  duration: ~3 minutes
  completed: 2026-02-26
---

# Phase 05 Plan 01: RRD Data API + Web Links Dropdown Summary

Proxmox RRD data API route proxying time-series resource metrics, plus Globe icon dropdown on dashboard container cards for quick-launch web service access.

## What Was Done

### Task 1: RRD Data Backend
Added `RrdDataPointSchema` to `schemas.ts` with all metric fields as `nullable().optional()` (Proxmox RRD gaps). Added `getContainerRrdData()` function to `containers.ts` that calls `/nodes/{node}/lxc/{vmid}/rrddata?timeframe={hour|day}` with Zod array validation. Created API route at `/api/containers/[node]/[vmid]/rrddata` following the exact pattern of the existing `status/route.ts` (session auth, node lookup, client creation, error handling). Added `RRD_HOUR_STALE_TIME_MS` (60s) and `RRD_DAY_STALE_TIME_MS` (5min) constants to `timeouts.ts` for Plan 02's TanStack Query integration.

### Task 2: Globe Web-Links Dropdown
Created `WebLinksDropdown` client component with `Globe` icon trigger button (`variant="ghost"`, `size="icon-xs"`) matching ContainerActions' MoreHorizontal pattern exactly. Each dropdown item wraps an `<a>` tag with `target="_blank"` linking to `http://<ip>:<port>`. Items show service name, port in muted text, and ExternalLink icon. Component returns `null` when no services or no container IP (no Globe icon rendered). Integrated into `container-card.tsx` by deriving `webServices` (non-system services with ports) from existing `useContainerServices` data and rendering `WebLinksDropdown` before `ContainerActions` in the card header.

## Deviations from Plan

None — plan executed exactly as written.

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | RRD data backend | 277df8b | schemas.ts, containers.ts, timeouts.ts, rrddata/route.ts |
| 2 | Globe web-links dropdown | 18c3049 | web-links-dropdown.tsx, container-card.tsx |

## Verification Results

- TypeScript: 8 pre-existing Zod v3→v4 errors (no new errors)
- API route file exists at correct path
- `RrdDataPointSchema` exported from schemas.ts
- `getContainerRrdData` exported from containers.ts
- `WebLinksDropdown` imported and rendered in container-card.tsx
- Services tab "Open Web UI" buttons NOT modified

## Next Phase Readiness

Plan 05-02 (Resource History Charts) can proceed — the RRD data API endpoint and TanStack Query stale-time constants are ready for consumption. The `getContainerRrdData` function and `RrdDataPointSchema` are exported for direct use.

## Self-Check: PASSED
