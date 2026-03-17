---
phase: 05-web-ui-monitoring
verified: 2026-03-08T00:45:00Z
status: passed
score: 8/8 must-haves verified
---

# Phase 05: Web UI & Monitoring Verification Report

**Phase Goal:** Add Proxmox RRD resource history charts and web-links dropdown to the dashboard (container cards get a Globe icon dropdown for web services; container detail gets CPU/Memory/Disk/Network area charts with timeframe toggle).
**Verified:** 2026-03-08T00:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                             | Status     | Evidence                                                                                          |
| --- | --------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| 1   | RRD API route returns time-series resource data for a container                   | VERIFIED   | `rrddata/route.ts` — GET handler with auth, node lookup, timeframe validation, Proxmox proxy, 502 fallback |
| 2   | Globe dropdown on dashboard cards shows all web-accessible services               | VERIFIED   | `web-links-dropdown.tsx` — renders all `services` with `http://<ip>:<port>` hrefs, no cap        |
| 3   | Clicking a dropdown item opens `http://<ip>:<port>` in a new tab                 | VERIFIED   | `<a href={url} target="_blank" rel="noopener noreferrer">` confirmed in `web-links-dropdown.tsx:51` |
| 4   | User can see CPU, Memory, Disk, and Network I/O history charts on Overview tab    | VERIFIED   | `resource-charts.tsx` — four `AreaChart` sections; `overview-tab.tsx` renders `<ResourceCharts>` below grid |
| 5   | User can toggle between 1-hour and 24-hour timeframes                             | VERIFIED   | `useState("hour")` + `<Tabs>` with `TabsTrigger value="hour"` / `value="day"` in `resource-charts.tsx:91–118` |
| 6   | Charts auto-refresh (1 min for hour view, 5 min for day view)                    | VERIFIED   | `useRrdData` sets `refetchInterval: staleTime` where `staleTime` is `RRD_HOUR_STALE_TIME_MS` (60s) or `RRD_DAY_STALE_TIME_MS` (300s) |
| 7   | Stopped containers show a placeholder instead of empty charts                     | VERIFIED   | `resource-charts.tsx:122–129` — `!isRunning` branch renders "No data available — container is stopped" with Monitor icon |
| 8   | Network I/O chart shows stacked in/out areas                                      | VERIFIED   | `stackId="1"` on both `<Area dataKey="netin">` and `<Area dataKey="netout">` at lines 308 and 317 |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact                                                                          | Expected                                         | Status     | Details                                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------ | ---------- | ---------------------------------------------------------------- |
| `apps/dashboard/src/app/api/containers/[node]/[vmid]/rrddata/route.ts`            | RRD data API route proxying Proxmox endpoint     | VERIFIED   | Exports `GET`; auth, node lookup, timeframe validation, 502 fallback all present |
| `apps/dashboard/src/lib/proxmox/schemas.ts`                                       | `RrdDataPointSchema` for Zod validation          | VERIFIED   | Exported at line 238; all metric fields `.nullable().optional()` |
| `apps/dashboard/src/lib/proxmox/containers.ts`                                    | `getContainerRrdData` function                   | VERIFIED   | Exported at line 248; calls `client.get` with `z.array(RrdDataPointSchema)` |
| `apps/dashboard/src/components/containers/web-links-dropdown.tsx`                 | Globe icon DropdownMenu for web services         | VERIFIED   | Exports `WebLinksDropdown`; null-guard for empty services or no IP; `target="_blank"` links |
| `apps/dashboard/src/components/containers/container-card.tsx`                     | Container card with Globe dropdown in header     | VERIFIED   | Imports and renders `<WebLinksDropdown>` at line 103; `webServices` derived from `appServices`; `containerIp` from `serviceData` |
| `apps/dashboard/src/hooks/use-rrd-data.ts`                                        | TanStack Query hook for fetching RRD data        | VERIFIED   | Exports `useRrdData` and `RrdDataPoint`; `queryKey` includes `timeframe`; `refetchInterval = staleTime` |
| `apps/dashboard/src/components/containers/detail/resource-charts.tsx`             | Four area charts with timeframe toggle           | VERIFIED   | Exports `ResourceCharts`; CPU/Memory/Disk/Network charts; `connectNulls` on all 5 `<Area>` elements |
| `apps/dashboard/src/components/containers/detail/overview-tab.tsx`                | Overview tab with charts section below grid      | VERIFIED   | Imports and renders `<ResourceCharts>` at line 358; wrapped in `div.space-y-6` |
| `apps/dashboard/src/components/ui/chart.tsx`                                      | shadcn/ui Chart component (Recharts wrapper)     | VERIFIED   | File exists; `recharts@2.15.4` in `package.json` |
| `apps/dashboard/src/lib/constants/timeouts.ts`                                    | RRD polling stale-time constants                 | VERIFIED   | `RRD_HOUR_STALE_TIME_MS = 60_000` at line 91; `RRD_DAY_STALE_TIME_MS = 5 * 60_000` at line 94 |

### Key Link Verification

| From                                              | To                                                | Via                             | Status   | Details                                                                      |
| ------------------------------------------------- | ------------------------------------------------- | ------------------------------- | -------- | ---------------------------------------------------------------------------- |
| `rrddata/route.ts`                                | `lib/proxmox/containers.ts`                       | `getContainerRrdData` import    | WIRED    | `import { getContainerRrdData }` at line 16; called at line 51               |
| `container-card.tsx`                              | `web-links-dropdown.tsx`                          | `WebLinksDropdown` render       | WIRED    | Import at line 11; `<WebLinksDropdown services={webServices} containerIp={containerIp} />` at line 103 |
| `use-rrd-data.ts`                                 | `/api/containers/[node]/[vmid]/rrddata`           | `fetch` call in `queryFn`       | WIRED    | `fetch(\`/api/containers/.../${vmid}/rrddata?timeframe=...\`)` at line 43    |
| `resource-charts.tsx`                             | `use-rrd-data.ts`                                 | `useRrdData` hook call          | WIRED    | `import { useRrdData, type RrdDataPoint }` at line 15; called at line 93     |
| `overview-tab.tsx`                                | `resource-charts.tsx`                             | `ResourceCharts` render         | WIRED    | `import { ResourceCharts }` at line 31; `<ResourceCharts nodeName=... vmid=... isRunning=...>` at line 358 |

### Requirements Coverage

No explicit requirement IDs were scoped to this phase. Goal coverage confirmed across all 8 observable truths.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | — | — | None detected |

The `return null` in `web-links-dropdown.tsx:35` is the intentional null-guard per spec (no Globe icon when no services or no IP). No stubs, placeholders, or empty implementations found.

### Human Verification Required

#### 1. Globe dropdown visual rendering

**Test:** Navigate to the dashboard with a running container that has discovered web services (e.g., a container with port 80 open). Confirm the Globe icon button appears to the left of the three-dot actions menu in the card header.
**Expected:** Globe icon visible; clicking reveals a dropdown with service name, `:port`, and external-link icon per item; clicking an item opens `http://<ip>:<port>` in a new browser tab.
**Why human:** Visual layout and browser tab behaviour cannot be verified by grep.

#### 2. Charts rendering on container detail Overview tab

**Test:** Open a running container's detail page, navigate to the Overview tab. Confirm four area charts appear below the Configuration and Resource Usage cards with a "1 Hour / 24 Hours" toggle in the card header.
**Expected:** CPU chart with 0-100% Y-axis; Memory/Disk charts with formatted byte Y-axes; Network I/O stacked chart with bytes/s; toggling timeframes triggers a fresh data fetch and re-renders charts.
**Why human:** Visual chart rendering and Recharts interactivity require a live browser.

#### 3. Stopped container placeholder

**Test:** Open the detail page of a stopped container (status != "running"). Check the Overview tab.
**Expected:** "Resource History" card renders with a Monitor icon and the text "No data available — container is stopped" instead of charts. No network request is fired for RRD data.
**Why human:** Requires a live container in stopped state to confirm conditional rendering and absence of network request.

#### 4. Auto-refresh behaviour

**Test:** Leave the detail page open for 60+ seconds on the 1-hour timeframe. Monitor browser network tab.
**Expected:** The browser fires a new request to `/api/containers/[node]/[vmid]/rrddata?timeframe=hour` approximately every 60 seconds.
**Why human:** Polling intervals require real time passage and network tab observation.

### Gaps Summary

No gaps found. All automated checks passed across all three verification levels (exists, substantive, wired) for every planned artifact and key link.

---

_Verified: 2026-03-08T00:45:00Z_
_Verifier: Claude (gsd-verifier)_
