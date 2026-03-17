---
phase: 05-web-ui-monitoring
plan: 02
subsystem: dashboard/monitoring
tags: [charts, recharts, rrd, resource-monitoring, shadcn]
dependency_graph:
  requires: ["05-01"]
  provides: ["resource-history-charts"]
  affects: ["containers/detail/overview-tab"]
tech_stack:
  added: ["recharts@2.15.4", "shadcn/ui Chart component"]
  patterns: ["TanStack Query client-side polling", "area charts with timeframe toggle"]
key_files:
  created:
    - apps/dashboard/src/components/ui/chart.tsx
    - apps/dashboard/src/hooks/use-rrd-data.ts
    - apps/dashboard/src/components/containers/detail/resource-charts.tsx
  modified:
    - apps/dashboard/src/components/containers/detail/overview-tab.tsx
    - apps/dashboard/package.json
    - pnpm-lock.yaml
decisions:
  - "Timeframe toggle implemented as Tabs component (not radio buttons) for consistent shadcn-first UI"
  - "CPU ratio-to-percent conversion done in transformRrdData to keep chart data clean"
  - "isRunning derived from container.status === 'running' (not liveMetrics presence) to avoid stale data edge case"
  - "Loading skeletons shown while data fetches, not empty charts"
metrics:
  duration: "25m"
  completed: "2026-03-08"
  tasks: 2
  files_created: 3
  files_modified: 3
---

# Phase 5 Plan 2: Resource History Charts Summary

**One-liner:** Four Recharts area charts (CPU/Memory/Disk/Network I/O) with 1h/24h toggle wired to Proxmox RRD API via TanStack Query hook.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install shadcn Chart component and create useRrdData hook | c5459ea | chart.tsx, use-rrd-data.ts, package.json, pnpm-lock.yaml |
| 2 | Create ResourceCharts component and integrate into Overview tab | 962745f | resource-charts.tsx, overview-tab.tsx |

## What Was Built

### Task 1: shadcn Chart + useRrdData hook

- Installed `recharts@2.15.4` as a dashboard dependency
- Generated `components/ui/chart.tsx` via shadcn CLI with `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, and `ChartConfig` type
- Created `hooks/use-rrd-data.ts` with:
  - `RrdDataPoint` interface (mirrors server-side Zod schema as client-safe TS type)
  - TanStack Query `useQuery` hook keyed by `[nodeName, vmid, timeframe]`
  - Stale times: 60s for hour view, 5min for day view
  - `refetchInterval` equals `staleTime` for automatic polling
  - `gcTime` of 10 minutes to keep data during brief navigation
  - `enabled` prop to disable fetching for stopped containers

### Task 2: ResourceCharts component + Overview tab integration

- Created `resource-charts.tsx` with:
  - `useState` for timeframe selection (default: "hour")
  - shadcn `Tabs` for 1 Hour / 24 Hours toggle
  - Four `AreaChart` components using Recharts via shadcn `ChartContainer`
  - **CPU chart:** 0-100% Y-axis (Proxmox returns ratio 0-1; multiplied by 100)
  - **Memory chart:** formatted bytes Y-axis and tooltip
  - **Disk chart:** formatted bytes Y-axis and tooltip
  - **Network I/O chart:** stacked in/out areas with bytes/s formatting
  - All charts use `connectNulls` for graceful null data point handling
  - Stopped container placeholder: "No data available — container is stopped"
  - Loading state: 4 `Skeleton` placeholders at h-[200px]
  - CSS variable colors: `var(--chart-1)` through `var(--chart-5)`
- Updated `overview-tab.tsx`:
  - Added import for `ResourceCharts`
  - Wrapped content in outer `div.space-y-6`
  - Added `<ResourceCharts>` below existing 2-column grid (full-width)
  - `isRunning` derived from `container.status === "running"`

## Verification

- `npx tsc --noEmit`: PASS (no type errors)
- `pnpm build`: PASS (production build succeeds, all routes rendered)
- `recharts` in `package.json`: 2.15.4
- `chart.tsx` in `components/ui/`: exists
- CPU Y-axis domain `[0, 100]` with `cpu * 100` conversion
- Memory/Disk/Network tooltips use `formatBytes`
- Network I/O uses `stackId="1"` on both Area components
- All Area components use `connectNulls`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files exist:
- `/tmp/infrahaus/apps/dashboard/src/components/ui/chart.tsx`: FOUND
- `/tmp/infrahaus/apps/dashboard/src/hooks/use-rrd-data.ts`: FOUND
- `/tmp/infrahaus/apps/dashboard/src/components/containers/detail/resource-charts.tsx`: FOUND
- `/tmp/infrahaus/apps/dashboard/src/components/containers/detail/overview-tab.tsx`: FOUND (modified)

### Commits exist:
- `c5459ea`: FOUND
- `962745f`: FOUND

## Self-Check: PASSED
