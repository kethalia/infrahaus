---
status: diagnosed
phase: 04-container-management
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md]
started: 2026-02-09T18:49:03Z
updated: 2026-02-09T20:01:10Z
---

## Current Test

[testing blocked - diagnosing Proxmox API connectivity issue]

## Tests

### 1. View Container Dashboard

expected: Navigate to dashboard. Page displays summary bar with 4 stat cards (Total, Running, Stopped, Error counts). Below shows container grid with cards displaying hostname, VMID, status badge, service dots, and resource summary. Empty state shows if no containers exist.
result: pass

### 2. Filter Containers by Status

expected: Click status filter pills (All/Running/Stopped/Creating/Error) above container grid. Grid updates to show only matching containers. Active filter has outline variant styling.
result: pass

### 3. Auto-refresh Countdown

expected: Dashboard shows countdown timer (30s). Clicking "Refresh Now" immediately fetches latest data and resets countdown. Countdown pauses when tab is hidden, resumes on focus.
result: pass

### 4. Container Lifecycle Actions from Dashboard

expected: Click dropdown menu on a container card. Select Start/Stop/Restart/Delete action. Destructive actions (Stop/Delete) show confirmation dialog before executing. Success shows toast notification. Container status updates after action.
result: issue
reported: "[safe-action] Unhandled server error: Error [ProxmoxError]: Request failed after 3 retries: Zod validation error - ha.managed expects boolean but receives number from Proxmox API. Confirmation dialog shows correctly but action execution fails with ProxmoxError."
severity: blocker

### 2. Filter Containers by Status

expected: Click status filter pills (All/Running/Stopped/Creating/Error) above container grid. Grid updates to show only matching containers. Active filter has outline variant styling.
result: [pending]

### 3. Auto-refresh Countdown

expected: Dashboard shows countdown timer (30s). Clicking "Refresh Now" immediately fetches latest data and resets countdown. Countdown pauses when tab is hidden, resumes on focus.
result: [pending]

### 4. Container Lifecycle Actions from Dashboard

expected: Click dropdown menu on a container card. Select Start/Stop/Restart/Delete action. Destructive actions (Stop/Delete) show confirmation dialog before executing. Success shows toast notification. Container status updates after action.
result: [pending]

### 5. Navigate to Container Detail Page

expected: Click a container card. Navigates to /containers/[id] showing container detail page with tabs (Overview, Services, Events). Header shows hostname and lifecycle action buttons.
result: issue
reported: "Page loads with tabs (Overview, Services, Events) but header is incomplete: shows 'CT 600' with only Delete button. Missing Start/Shutdown/Stop/Restart buttons. Hostname displays as '—' instead of 'test-container'."
severity: major

### 6. Container Overview Tab

expected: Overview tab shows two columns: left has config grid (hostname, OS template, cores, memory, IP, features, tags), right shows live resource usage bars (CPU, memory, disk) with color coding (green <70%, yellow 70-90%, red >90%).
result: issue
reported: "Shows 'Unable to reach Proxmox API. Live status and resource data may be stale. Actions may not work until connectivity is restored.' Config grid loads but shows missing values (hostname/OS template/cores/memory as '—'). Resource usage section shows 'Container is stopped or data unavailable'."
severity: blocker

### 7. Services Tab Display

expected: Services tab shows service cards with service name, status badge, running/listening ports, and web UI link button (if applicable). Credentials section shows per-service credentials with reveal/copy buttons.
result: skipped
reason: Blocked by Proxmox API connectivity issue - cannot verify data accuracy

### 8. Refresh Container Services

expected: Click "Refresh" button in Services tab. Triggers SSH-based monitoring to check systemd services, discover ports, read credentials. Services list updates with latest status after refresh completes.
result: skipped
reason: Blocked by Proxmox API connectivity issue

### 9. Reveal Service Credentials

expected: Click reveal icon on a service credential. Credential value becomes visible. Click copy button to copy to clipboard. Shows toast notification on copy.
result: skipped
reason: Blocked by Proxmox API connectivity issue

### 10. Events Tab Timeline

expected: Events tab shows chronological timeline with color-coded icons by type (created, started, stopped, etc.). Each event shows relative timestamp and description. Click event to expand and view metadata.
result: skipped
reason: Blocked by Proxmox API connectivity issue

### 11. Filter Events by Type

expected: Click filter buttons above events timeline (All/Info/Success/Error). Timeline updates to show only matching event types. Active filter has visual indication.
result: skipped
reason: Blocked by Proxmox API connectivity issue

### 12. Detail Page Auto-refresh

expected: Container detail page shows auto-refresh countdown (30s) matching dashboard behavior. Refreshes all tabs (overview resources, services, events) when countdown completes or "Refresh Now" clicked.
result: skipped
reason: Blocked by Proxmox API connectivity issue

### 13. Full Lifecycle Actions in Detail Header

expected: Detail page header shows individual buttons for all lifecycle actions (Start, Shutdown, Stop, Restart, Delete). Destructive actions show AlertDialog confirmation. Actions trigger with toast feedback and page refreshes after completion.
result: skipped
reason: Blocked by Proxmox API connectivity issue - related to Test 4 & 5 issues

### 14. Smart Routing for Creating Containers

expected: Navigate to /containers/[id] where container has status "creating". Automatically redirects to /containers/[id]/progress page showing creation progress.
result: skipped
reason: Cannot test without creating container (blocked by API issues)

### 15. 404 for Missing Containers

expected: Navigate to /containers/[id] with non-existent ID. Shows 404 page or error message indicating container not found.
result: skipped
reason: Blocked by Proxmox API connectivity issue

### 8. Refresh Container Services

expected: Click "Refresh" button in Services tab. Triggers SSH-based monitoring to check systemd services, discover ports, read credentials. Services list updates with latest status after refresh completes.
result: [pending]

### 9. Reveal Service Credentials

expected: Click reveal icon on a service credential. Credential value becomes visible. Click copy button to copy to clipboard. Shows toast notification on copy.
result: [pending]

### 10. Events Tab Timeline

expected: Events tab shows chronological timeline with color-coded icons by type (created, started, stopped, etc.). Each event shows relative timestamp and description. Click event to expand and view metadata.
result: [pending]

### 11. Filter Events by Type

expected: Click filter buttons above events timeline (All/Info/Success/Error). Timeline updates to show only matching event types. Active filter has visual indication.
result: [pending]

### 12. Detail Page Auto-refresh

expected: Container detail page shows auto-refresh countdown (30s) matching dashboard behavior. Refreshes all tabs (overview resources, services, events) when countdown completes or "Refresh Now" clicked.
result: [pending]

### 13. Full Lifecycle Actions in Detail Header

expected: Detail page header shows individual buttons for all lifecycle actions (Start, Shutdown, Stop, Restart, Delete). Destructive actions show AlertDialog confirmation. Actions trigger with toast feedback and page refreshes after completion.
result: [pending]

### 14. Smart Routing for Creating Containers

expected: Navigate to /containers/[id] where container has status "creating". Automatically redirects to /containers/[id]/progress page showing creation progress.
result: [pending]

### 15. 404 for Missing Containers

expected: Navigate to /containers/[id] with non-existent ID. Shows 404 page or error message indicating container not found.
result: [pending]

## Summary

total: 15
passed: 3
issues: 3
pending: 0
skipped: 9

## Gaps

- truth: "Lifecycle actions execute successfully from dashboard dropdown menu"
  status: failed
  reason: "User reported: [safe-action] Unhandled server error: Error [ProxmoxError]: Request failed after 3 retries: Zod validation error - ha.managed expects boolean but receives number from Proxmox API. Confirmation dialog shows correctly but action execution fails with ProxmoxError."
  severity: blocker
  test: 4
  root_cause: "ContainerStatusSchema.ha.managed field expects boolean type but Proxmox API returns integers (0/1), causing Zod validation to fail when lifecycle actions query container status"
  artifacts:
  - path: "apps/dashboard/src/lib/proxmox/schemas.ts"
    issue: "Line 144: ha.managed uses z.boolean() instead of pveBoolean helper"
  - path: "apps/dashboard/src/lib/containers/actions.ts"
    issue: "Line 629: Stop action calls getContainer() which triggers validation failure"
  - path: "apps/dashboard/src/lib/proxmox/containers.ts"
    issue: "Lines 88-91: getContainer() validates response with broken schema"
    missing:
  - "Replace z.boolean() with pveBoolean for ha.managed field in ContainerStatusSchema"
  - "Audit other boolean fields (template, onboot, console, protection, unprivileged) for same issue"
    debug_session: ".planning/debug/lifecycle-actions-zod-error.md"

- truth: "Container detail page header shows hostname and all lifecycle action buttons"
  status: failed
  reason: "User reported: Page loads with tabs (Overview, Services, Events) but header is incomplete: shows 'CT 600' with only Delete button. Missing Start/Shutdown/Stop/Restart buttons. Hostname displays as '—' instead of 'test-container'."
  severity: major
  test: 5
  root_cause: "Container status set to 'unknown' when Proxmox API is unreachable, causing conditional rendering logic to hide all lifecycle buttons except Delete; hostname unavailable because only sourced from Proxmox live data, not stored in database"
  artifacts:
  - path: "apps/dashboard/src/lib/containers/data.ts"
    issue: "Line 326: sets status='unknown' when !proxmoxReachable; Line 333: hostname extracted only from Proxmox data with no DB fallback"
  - path: "apps/dashboard/src/components/containers/detail/container-header.tsx"
    issue: "Line 58: isActionable excludes 'unknown' status; Lines 184-225: buttons conditionally render only for running/stopped"
  - path: "apps/dashboard/prisma/schema.prisma"
    issue: "Lines 153-172: Container model lacks hostname field for fallback storage"
    missing:
  - "Add hostname field to Container database schema and populate during creation"
  - "Modify mergeContainerStatus() to use DB hostname as fallback"
  - "Update conditional rendering for 'unknown' status (show disabled buttons or let actions fail gracefully)"
    debug_session: ".planning/debug/missing-lifecycle-buttons.md"

- truth: "Overview tab displays complete configuration data and live resource usage"
  status: failed
  reason: "User reported: Shows 'Unable to reach Proxmox API. Live status and resource data may be stale. Actions may not work until connectivity is restored.' Config grid loads but shows missing values (hostname/OS template/cores/memory as '—'). Resource usage section shows 'Container is stopped or data unavailable'."
  severity: blocker
  test: 6
  root_cause: "Zod schema validation error in ContainerStatusSchema - ha.managed field expects boolean but Proxmox API returns number (0 or 1), causing all container detail page requests to fail and be misinterpreted as 'Proxmox API unreachable'"
  artifacts:
  - path: "apps/dashboard/src/lib/proxmox/schemas.ts"
    issue: "Lines 142-146: ha.managed: z.boolean() should be pveBoolean to coerce number to boolean"
  - path: "apps/dashboard/src/lib/containers/data.ts"
    issue: "Lines 243-244: catch block silently swallows Zod errors, making debugging difficult"
  - path: "apps/dashboard/src/lib/proxmox/containers.ts"
    issue: "Lines 83-92: getContainer() uses broken schema"
    missing:
  - "Change ContainerStatusSchema.ha.managed from z.boolean() to pveBoolean helper"
  - "Add better error logging in data.ts catch block to surface validation errors"
  - "Consider caching Proxmox config data in database for graceful degradation"
    debug_session: ".planning/debug/proxmox-api-connectivity-failure.md"
