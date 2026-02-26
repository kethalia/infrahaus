# Phase 05: Web UI & Monitoring - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Service discovery with web UI access links and resource usage monitoring. Containers already have service discovery (systemd + port scanning via SSH), status polling (2s), and basic resource bars on the detail page. This phase adds clickable web UI links for services, historical resource charts from Proxmox RRD data, and a quick-launch dropdown on dashboard cards.

</domain>

<decisions>
## Implementation Decisions

### Web UI Access Links
- "Open" button on the detail page Services tab for each web-accessible service (opens `http://<container-ip>:<port>` in new tab)
- Quick-launch DropdownMenu on dashboard container cards with Globe icon button in card header (next to existing ContainerActions three-dot menu)
- URLs constructed as `http://<container-ip>:<port>` — no configurable base URLs, no reverse proxy support
- No pre-flight reachability checks — browser handles unreachable services natively
- Dropdown shows ALL web-accessible services (not limited to 3 like the inline list)
- Each dropdown item shows: service name + port + external link icon

### Resource History Charts
- Charts live on the existing Overview tab of the container detail page, below the current resource bars
- All four metrics charted: CPU, Memory, Disk, Network I/O
- Two timeframes via toggle: 1 hour (1-min resolution) and 24 hours (5-min resolution) — maps directly to Proxmox RRD API `timeframe=hour` and `timeframe=day`
- Area charts (filled) for CPU, Memory, Disk
- Stacked area chart for Network I/O (in + out)

### Dashboard Card Density
- No sparklines or mini-charts on dashboard cards — keep current text-based `CPU X% · Mem Y/Z` resource line
- Keep existing inline service list (up to 3 services with status dots) for at-a-glance info
- Globe icon DropdownMenu in card header is the quick-launch affordance — separate from the inline service list
- Two icon buttons in card header: Globe (web links) + three-dot (lifecycle actions)

### Service Health Checking
- No active HTTP probing of service URLs — systemd service status + listening port detection is sufficient
- Status badge + "last checked" timestamp on detail page Services tab (uses existing `discoveredAt` from cache)
- Auto-refresh services on detail page visit if cache is older than 5 minutes (matches existing TanStack Query staleTime)
- Manual refresh button always available on Services tab

### Claude's Discretion
- Chart library choice (shadcn/ui Chart component wrapping Recharts is the likely candidate — already follows project conventions)
- Chart colors, sizing, and responsive behavior
- Exact layout of charts relative to existing resource bars
- RRD data caching strategy (Redis TTL, refresh pattern)
- How to handle charts for stopped containers (no RRD data)
- "Open" button styling and placement within the Services tab
- Globe icon dropdown trigger styling

</decisions>

<specifics>
## Specific Ideas

- Quick-launch dropdown should follow the same pattern as the existing ContainerActions dropdown (DropdownMenu component, icon button trigger)
- Area chart + stacked area style matches standard monitoring dashboards (Proxmox UI, Grafana) — users will find it familiar
- The 5-minute staleness threshold for auto-refresh is intentionally aligned with the TanStack Query staleTime already used by `useContainerServices` on dashboard cards — one consistent freshness window across the app
- Proxmox RRD API returns `{ time, cpu, maxcpu, mem, maxmem, disk, maxdisk, netin, netout }` arrays — no transformation needed for chart data beyond formatting

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-web-ui-monitoring*
*Context gathered: 2026-02-25*
