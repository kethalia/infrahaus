# Phase 05: Web UI & Monitoring - Research

**Researched:** 2026-02-25
**Domain:** Proxmox RRD API, shadcn/ui Charts (Recharts), Web UI access links
**Confidence:** HIGH

## Summary

This phase adds resource history charts (from Proxmox RRD data), web UI quick-launch links on dashboard cards, and a Globe dropdown for service access. The technical foundation is solid: Proxmox has a well-documented RRD API that returns pre-aggregated time series data, shadcn/ui provides a Chart component wrapping Recharts with full area chart support, and the existing codebase already has chart CSS variables defined in globals.css.

The main implementation work is: (1) a new API route to proxy RRD data from Proxmox, (2) installing the shadcn Chart component + Recharts, (3) building 4 area charts on the Overview tab, and (4) adding a Globe DropdownMenu to container cards.

**Primary recommendation:** Use shadcn/ui Chart component (Recharts wrapper) with TanStack Query for RRD data fetching. No Redis caching needed for RRD data — Proxmox already maintains its own RRD database; just fetch-on-demand with TanStack Query's staleTime handling client-side freshness.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Web UI Access Links:** "Open" button on detail page Services tab (already exists). Quick-launch DropdownMenu on dashboard container cards with Globe icon button in card header. URLs as `http://<container-ip>:<port>`. No pre-flight reachability checks. Dropdown shows ALL web-accessible services.
- **Resource History Charts:** Charts on Overview tab below resource bars. All four metrics: CPU, Memory, Disk, Network I/O. Two timeframes via toggle: 1 hour (1-min resolution) and 24 hours (5-min resolution). Maps to Proxmox RRD API `timeframe=hour` and `timeframe=day`. Area charts (filled) for CPU, Memory, Disk. Stacked area chart for Network I/O (in + out).
- **Dashboard Card Density:** No sparklines/mini-charts on cards. Globe icon DropdownMenu in card header — separate from inline service list. Two icon buttons in card header: Globe (web links) + three-dot (lifecycle actions).
- **Service Health Checking:** No HTTP probing. Status badge + "last checked" on Services tab. Auto-refresh if cache > 5 min.

### Claude's Discretion
- Chart library choice (shadcn/ui Chart wrapping Recharts)
- Chart colors, sizing, responsive behavior
- Layout of charts relative to existing resource bars
- RRD data caching strategy (Redis TTL, refresh pattern)
- Stopped container charts handling
- Button/icon styling

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 2.x (latest) | Chart rendering | shadcn/ui Chart component wraps Recharts; project convention |
| shadcn/ui Chart | latest | ChartContainer, ChartTooltip, ChartConfig wrappers | Project uses shadcn/ui for all UI components |
| @tanstack/react-query | ^5.90.21 | Client-side RRD data fetching + caching | Already installed, used by useContainerServices |

### Already Installed (no additions needed)
| Library | Purpose |
|---------|---------|
| lucide-react | Globe icon for dropdown trigger |
| @radix-ui/react-dropdown-menu | DropdownMenu component (already installed) |
| zod | Schema validation for RRD API response |

### Installation
```bash
# From apps/dashboard directory:
npx shadcn@latest add chart
# This installs recharts + adds components/ui/chart.tsx
```

**Note:** The shadcn `chart` command installs Recharts as a dependency automatically and generates `components/ui/chart.tsx` with `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent` components.

## Architecture Patterns

### 1. Proxmox RRD API

**Endpoint:** `GET /nodes/{node}/lxc/{vmid}/rrddata`

**Parameters:**
| Parameter | Type | Required | Values | Description |
|-----------|------|----------|--------|-------------|
| `node` | string | Yes | (path) | Cluster node name |
| `vmid` | integer | Yes | (path) | Container VMID (100-999999999) |
| `timeframe` | string | Yes | `hour`, `day`, `week`, `month`, `year` | Time range |
| `cf` | string | No | `AVERAGE`, `MAX` | Consolidation function (default: AVERAGE) |

**Auth:** Same as all Proxmox API calls — uses existing ProxmoxClient with API token auth.

**Permission:** Requires `VM.Audit` on `/vms/{vmid}` (already satisfied by API token used in this project).

**Response shape:** Array of objects (confirmed from Proxmox API schema + user's note):
```typescript
// Each element is an RRD data point
interface RrdDataPoint {
  time: number;      // Unix timestamp (seconds)
  cpu: number;       // CPU usage ratio (0-1, NOT percentage)
  maxcpu: number;    // Number of CPUs allocated
  mem: number;       // Memory used (bytes)
  maxmem: number;    // Memory allocated (bytes)
  disk: number;      // Disk used (bytes)
  maxdisk: number;   // Disk allocated (bytes)
  netin: number;     // Network bytes received (cumulative rate/s)
  netout: number;    // Network bytes sent (cumulative rate/s)
}
```

**Data resolution (confirmed from API schema):**
- `timeframe=hour`: ~70 data points, 1-minute resolution (last 70 minutes)
- `timeframe=day`: ~70 data points, ~20-minute resolution (last 24 hours)

**Important notes:**
- `cpu` is a **ratio (0-1)**, not percentage — multiply by 100 for chart display
- `netin`/`netout` are **rates** (bytes/sec), not cumulative totals
- Some data points may have `null`/`undefined` values for metrics (gaps in RRD data)
- Stopped containers return **empty arrays** or very stale data
- Confidence: HIGH (verified from Proxmox API schema JSON at pve.proxmox.com/pve-docs/api-viewer/apidoc.js)

### 2. New API Route Pattern

Follow existing pattern from `apps/dashboard/src/app/api/containers/[node]/[vmid]/status/route.ts`:

```
apps/dashboard/src/app/api/containers/[node]/[vmid]/rrddata/route.ts
```

```typescript
// GET /api/containers/{node}/{vmid}/rrddata?timeframe=hour
// Query param: timeframe (hour | day)
// Returns: RrdDataPoint[]
```

### 3. New Proxmox Client Function

Add to `lib/proxmox/containers.ts` following existing patterns:

```typescript
export async function getContainerRrdData(
  client: ProxmoxClient,
  node: string,
  vmid: number,
  timeframe: "hour" | "day",
): Promise<RrdDataPoint[]> {
  return client.get(
    `/nodes/${node}/lxc/${vmid}/rrddata?timeframe=${timeframe}`,
    z.array(RrdDataPointSchema),
  );
}
```

### 4. Client-Side Data Hook

Use TanStack Query (like `useContainerServices`) instead of custom polling:

```typescript
// hooks/use-rrd-data.ts
export function useRrdData({ nodeName, vmid, timeframe, enabled }: Options) {
  return useQuery({
    queryKey: ["rrd-data", nodeName, vmid, timeframe],
    queryFn: () => fetchRrdData(nodeName, vmid, timeframe),
    staleTime: timeframe === "hour" ? 60_000 : 5 * 60_000,
    gcTime: 10 * 60_000,
    enabled,
    refetchInterval: timeframe === "hour" ? 60_000 : 5 * 60_000,
  });
}
```

### 5. shadcn/ui Chart Component Usage (Area Chart)

Source: Official shadcn/ui Chart documentation (ui.shadcn.com/docs/components/chart)

```typescript
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  cpu: {
    label: "CPU",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

// Usage
<ChartContainer config={chartConfig} className="min-h-[200px] w-full">
  <AreaChart data={rrdData} accessibilityLayer>
    <CartesianGrid vertical={false} />
    <XAxis
      dataKey="time"
      tickLine={false}
      axisLine={false}
      tickFormatter={(ts) => formatTime(ts)}
    />
    <YAxis tickFormatter={(v) => `${v}%`} />
    <ChartTooltip content={<ChartTooltipContent />} />
    <Area
      type="monotone"
      dataKey="cpu"
      fill="var(--color-cpu)"
      fillOpacity={0.3}
      stroke="var(--color-cpu)"
    />
  </AreaChart>
</ChartContainer>
```

**For stacked Network I/O chart:**
```typescript
<AreaChart data={rrdData} accessibilityLayer>
  <Area
    type="monotone"
    dataKey="netin"
    stackId="1"
    fill="var(--color-netin)"
    fillOpacity={0.3}
    stroke="var(--color-netin)"
  />
  <Area
    type="monotone"
    dataKey="netout"
    stackId="1"
    fill="var(--color-netout)"
    fillOpacity={0.3}
    stroke="var(--color-netout)"
  />
</AreaChart>
```

### 6. Recommended Chart Layout

```
Overview Tab (overview-tab.tsx)
├── Grid: Configuration Card | Resource Usage Card  ← existing
└── Full-width section below grid                   ← NEW
    ├── Timeframe toggle (1h | 24h)                 ← Tabs or ToggleGroup
    ├── CPU Chart (AreaChart, filled)
    ├── Memory Chart (AreaChart, filled)
    ├── Disk Chart (AreaChart, filled)
    └── Network I/O Chart (StackedAreaChart)
```

### 7. Globe DropdownMenu on Container Card

Follow exact pattern from `ContainerActions` (DropdownMenu + icon button trigger):

```typescript
// In container-card.tsx card header, next to ContainerActions:
<div className="flex items-center gap-1.5">
  <WebLinksDropdown services={webServices} containerIp={containerIp} />
  <ContainerActions ... />
</div>
```

### Recommended Project Structure
```
apps/dashboard/src/
├── app/api/containers/[node]/[vmid]/
│   └── rrddata/route.ts              # NEW: RRD data API route
├── components/containers/
│   ├── container-card.tsx             # MODIFY: Add Globe dropdown
│   ├── web-links-dropdown.tsx         # NEW: Globe icon DropdownMenu
│   └── detail/
│       ├── overview-tab.tsx           # MODIFY: Add charts section
│       └── resource-charts.tsx        # NEW: Chart components
├── hooks/
│   └── use-rrd-data.ts               # NEW: TanStack Query hook
├── lib/proxmox/
│   ├── containers.ts                 # MODIFY: Add getContainerRrdData
│   └── schemas.ts                    # MODIFY: Add RrdDataPointSchema
└── lib/constants/
    └── timeouts.ts                   # MODIFY: Add RRD polling constants
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering | Custom SVG/Canvas charts | shadcn/ui Chart (Recharts) | Responsive, accessible, themed, tooltip/legend support |
| Chart theming | Custom color management | ChartConfig + CSS variables | `--chart-1` through `--chart-5` already defined in globals.css |
| Client data caching | Custom fetch + useState | TanStack Query `useQuery` | Dedup, stale-while-revalidate, refetchInterval, loading states |
| Dropdown menu | Custom popover | shadcn DropdownMenu | Already used by ContainerActions — consistent UX |
| Time formatting | Manual date math | `Intl.DateTimeFormat` or existing `formatRelativeTime` | Browser-native, locale-aware |

## Common Pitfalls

### Pitfall 1: CPU Value is a Ratio, Not Percentage
**What goes wrong:** Displaying raw `cpu` value (e.g., 0.15) on chart instead of 15%
**Why it happens:** Proxmox RRD returns CPU as a 0-1 ratio, unlike the `/status/current` endpoint where the codebase already multiplies by 100
**How to avoid:** Transform `cpu * 100` when preparing chart data, same as done in `status/route.ts` line 42
**Warning signs:** Charts showing values between 0-1 instead of 0-100%

### Pitfall 2: Null/Undefined RRD Data Points
**What goes wrong:** Charts break or show NaN when RRD has gaps
**Why it happens:** Proxmox RRD may have null values for some data points (especially after container restart or during maintenance)
**How to avoid:** Use `connectNulls` prop on Recharts `<Area>` component; filter/default nulls in data transform
**Warning signs:** Broken chart lines, NaN in tooltips

### Pitfall 3: Stopped Container = No RRD Data
**What goes wrong:** Empty chart or error state when viewing stopped container
**Why it happens:** Proxmox stops collecting RRD data when container is stopped; API returns empty array
**How to avoid:** Check `data.length === 0` and show "No data available — container is stopped" placeholder (same pattern as existing `OverviewTab` empty state)
**Warning signs:** Blank charts, loading spinners that never resolve

### Pitfall 4: RRD Data Ordering
**What goes wrong:** Chart X-axis is not chronological
**Why it happens:** Proxmox returns data in chronological order already, but if data is transformed incorrectly the order might break
**How to avoid:** Trust Proxmox ordering; use `time` field for X-axis dataKey
**Warning signs:** Zigzag lines on chart

### Pitfall 5: Network I/O Units
**What goes wrong:** Displaying raw bytes/sec without formatting
**Why it happens:** `netin`/`netout` are in bytes/sec — large numbers without formatting are unreadable
**How to avoid:** Use existing `formatBytes` utility for tooltip values; use appropriate Y-axis formatter
**Warning signs:** Y-axis showing values like "1543234567"

## RRD Data Caching Recommendation

**Recommendation: NO Redis caching for RRD data. Use TanStack Query client-side only.**

**Rationale:**
1. **Proxmox IS the cache.** RRD data is already pre-aggregated and stored in Proxmox's RRD database. The API call is a lightweight read from an optimized time-series store — not a compute-heavy operation.
2. **Short-lived data.** The `timeframe=hour` data changes every minute. Caching in Redis means either stale data or complex TTL management for minimal benefit.
3. **Low request volume.** RRD data is only fetched on the container detail page (single user viewing one container). This is not a hot path like dashboard cards.
4. **TanStack Query handles freshness.** With `staleTime: 60s` for hour view and `staleTime: 5min` for day view, the client avoids redundant fetches without server-side caching.
5. **Complexity cost.** Adding Redis caching means: cache key management, TTL tuning, cache invalidation for different timeframes, serialization overhead — all for minimal gain.

**Confidence: HIGH** — This matches the pattern used by existing `useContainerServices` hook (TanStack Query + API route, no intermediate Redis cache for read-through data).

**Polling strategy:**
- `timeframe=hour`: `refetchInterval: 60_000` (1 min) — matches data resolution
- `timeframe=day`: `refetchInterval: 300_000` (5 min) — data only updates every ~20 min anyway

## Code Examples

### Zod Schema for RRD Data
```typescript
// Source: Proxmox API schema (apidoc.js), verified
export const RrdDataPointSchema = z.object({
  time: z.number(),
  cpu: z.number().nullable().optional(),
  maxcpu: z.number().nullable().optional(),
  mem: z.number().nullable().optional(),
  maxmem: z.number().nullable().optional(),
  disk: z.number().nullable().optional(),
  maxdisk: z.number().nullable().optional(),
  netin: z.number().nullable().optional(),
  netout: z.number().nullable().optional(),
});
```

### API Route (follows existing status/route.ts pattern)
```typescript
// app/api/containers/[node]/[vmid]/rrddata/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionData } from "@/lib/session";
import { DatabaseService } from "@/lib/db";
import { createSessionClient } from "@/lib/containers/helpers";
import { getContainerRrdData } from "@/lib/proxmox/containers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ node: string; vmid: string }> },
) {
  const session = await getSessionData();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { node: nodeName, vmid: vmidStr } = await params;
  const vmid = parseInt(vmidStr, 10);
  const timeframe = request.nextUrl.searchParams.get("timeframe");

  if (!timeframe || !["hour", "day"].includes(timeframe)) {
    return NextResponse.json(
      { error: "Invalid timeframe. Use 'hour' or 'day'" },
      { status: 400 },
    );
  }

  // ... auth + fetch pattern identical to status/route.ts
  const data = await getContainerRrdData(client, nodeName, vmid, timeframe as "hour" | "day");
  return NextResponse.json(data);
}
```

### ChartConfig for Resource Charts
```typescript
// Source: shadcn/ui Chart docs (ui.shadcn.com/docs/components/chart)
const cpuChartConfig = {
  cpu: { label: "CPU %", color: "var(--chart-1)" },
} satisfies ChartConfig;

const memoryChartConfig = {
  mem: { label: "Memory", color: "var(--chart-2)" },
} satisfies ChartConfig;

const diskChartConfig = {
  disk: { label: "Disk", color: "var(--chart-3)" },
} satisfies ChartConfig;

const networkChartConfig = {
  netin: { label: "In", color: "var(--chart-4)" },
  netout: { label: "Out", color: "var(--chart-5)" },
} satisfies ChartConfig;
```

### Timeframe Toggle
```typescript
// Use shadcn Tabs or ToggleGroup for timeframe selection
<Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as "hour" | "day")}>
  <TabsList>
    <TabsTrigger value="hour">1 Hour</TabsTrigger>
    <TabsTrigger value="day">24 Hours</TabsTrigger>
  </TabsList>
</Tabs>
```

## Open Questions

1. **RRD data for recently-started containers**
   - What we know: Proxmox starts collecting data immediately on container start
   - What's unclear: How many data points are available in the first few minutes (likely sparse)
   - Recommendation: Handle gracefully — show whatever data exists, `connectNulls` fills gaps

2. **Chart height on mobile**
   - What we know: Charts need `min-h-[VALUE]` on ChartContainer
   - What's unclear: Optimal height for 4 charts stacked vertically on mobile
   - Recommendation: Use responsive heights, e.g., `min-h-[200px]` on desktop, consider collapsible sections on mobile

## Sources

### Primary (HIGH confidence)
- Proxmox API schema (apidoc.js) — RRD endpoint path, parameters, response shape verified from official JSON schema
- shadcn/ui Chart documentation (ui.shadcn.com/docs/components/chart) — Installation, ChartContainer, ChartConfig, AreaChart patterns
- Existing codebase — ProxmoxClient.get() pattern, API route patterns, TanStack Query hooks, ContainerActions DropdownMenu

### Secondary (MEDIUM confidence)
- Proxmox VE API wiki (pve.proxmox.com/wiki/Proxmox_VE_API) — Authentication, general API patterns

## Metadata

**Confidence breakdown:**
- Proxmox RRD API: HIGH — verified from official API schema JSON
- shadcn/ui Chart: HIGH — verified from official docs + chart CSS vars already in globals.css
- Caching strategy: HIGH — follows existing TanStack Query patterns in codebase
- Chart layout: MEDIUM — recommended based on existing Overview tab structure; exact responsive behavior TBD

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable APIs, unlikely to change)
