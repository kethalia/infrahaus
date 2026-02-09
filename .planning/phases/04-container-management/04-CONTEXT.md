# Phase 4: Container Management - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can monitor and control container lifecycle with a dashboard overview and detail pages. Includes a dashboard grid with summary counts, container cards with quick actions, and a detail page with tabbed view (Overview, Services, Events). Service monitoring via SSH refreshes service status on demand.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Card Content & Layout

- Hostname + status badge are the most prominent elements on each card; VMID, template, services are secondary/muted
- Show first 2-3 service names with colored status dots on the card; if more services exist, show "+N more" summary that links to detail
- Include a text-only resource summary line on cards — "CPU 23% · Mem 256/512 MB" — no progress bars on cards
- Responsive grid with fixed card height: 3 columns on desktop, 2 on tablet, 1 on mobile

### Lifecycle Action UX

- Destructive actions (stop, delete) confirmed via shadcn AlertDialog showing container hostname and VMID — not browser `confirm()`
- Card actions use a dropdown menu (three-dot/ellipsis button) to keep cards compact; detail page header uses full buttons
- After a lifecycle action: button shows loading spinner, toast notification confirms the result (success or error), status updates via `revalidatePath` — no optimistic status updates
- After deleting from detail page, redirect to dashboard ("/")

### Service & Credential Presentation

- Per-service credential toggle with copy buttons — each service has its own "Show Credentials" button revealing a key-value grid with copy-to-clipboard on each value
- Each service rendered as its own Card (stacked vertically) with name, type badge, status dot, port, web UI link, and credential toggle
- "Open Web UI" as a visible shadcn Button (variant="outline") with external link icon, opens in new tab
- Service refresh: spinner on refresh button + button disabled while running + toast for the result

### Status Freshness & Auto-Refresh

- Dashboard auto-refreshes every 30 seconds
- Live countdown timer showing seconds until next refresh, with a "Refresh Now" button to trigger immediate refresh
- Subtle warning banner when Proxmox API is unreachable: "Could not reach Proxmox — showing last known status" with Retry button
- Auto-refresh pauses when browser tab is hidden (`visibilitychange`), immediate refresh on tab focus return
- Detail page uses the same 30s refresh cycle with countdown — consistent behavior across pages

### Claude's Discretion

- Exact countdown timer styling and placement
- Warning banner dismiss behavior
- Card footer layout details
- Dropdown menu icon choices and styling
- Service card spacing and internal layout
- Progress bar colors on detail page Overview tab
- Event timeline icon choices and colors

</decisions>

<specifics>
## Specific Ideas

- Service dots on cards: use colored dots (green/gray/red) inline with service name for quick health scanning
- "+N more" on cards should link/navigate to the detail page Services tab
- Countdown timer should feel unobtrusive — small muted text near the grid header, not a large UI element
- AlertDialog for destructive actions should clearly name the container: "Are you sure you want to delete **gitea-server** (VMID 105)?"

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 04-container-management_
_Context gathered: 2026-02-09_
