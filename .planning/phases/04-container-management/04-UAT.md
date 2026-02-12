---
status: complete
phase: 04-container-management
source:
  [
    04-01-SUMMARY.md,
    04-02-SUMMARY.md,
    04-03-SUMMARY.md,
    04-04-SUMMARY.md,
    04-05-SUMMARY.md,
    04-06-SUMMARY.md,
    04-07-SUMMARY.md,
    04-08-SUMMARY.md,
  ]
started: 2026-02-10T16:00:00Z
updated: 2026-02-12T00:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. View Container Dashboard

expected: Navigate to dashboard. You should see summary bar with stat cards, container grid with cards, status filters, auto-refresh countdown, and Create Container button in header
result: pass

### 2. Filter Containers by Status

expected: Click status filter pills (Running, Stopped, etc.). Grid updates to show only containers matching that status. Active filter has different styling (filled vs outline)
result: pass

### 3. Container Card Displays Info

expected: Each container card shows hostname, VMID, color-coded status badge, service dots (green/yellow/red), and resource bars for CPU/memory/disk
result: pass

### 4. Start Container from Dashboard

expected: Click dropdown menu on a stopped container card, select "Start". Card shows loading spinner next to status badge. After completion, status updates to "running" and toast notification appears
result: pass

### 5. Stop Container from Dashboard

expected: Click dropdown menu on running container, select "Stop". AlertDialog appears asking for confirmation. Confirm shows loading spinner, then status updates to "stopped" with toast notification
result: pass

### 6. Delete Container from Dashboard

expected: Click dropdown menu on container, select "Delete". AlertDialog appears with destructive styling asking for confirmation. Confirm removes container from grid after loading and shows toast notification
result: pass

### 7. Auto-Refresh Updates Status

expected: Wait for 30-second countdown to reach 0 or click "Refresh Now". Dashboard re-fetches data, container statuses and counts update without page reload
result: pass

### 8. Navigate to Container Detail

expected: Click on a container card. Navigates to /containers/[id] detail page showing container header with action buttons and three tabs (Overview, Services, Events)
result: pass

### 9. Container Detail Overview Tab

expected: Overview tab shows two columns: left has config grid (hostname, OS template, cores, memory, network, features, tags), right has live resource bars with color coding (green <70%, yellow 70-90%, red >90%)
result: pass

### 10. Container Detail Services Tab

expected: Services tab shows service cards with status indicators, web UI links as outline buttons, and "Refresh Services" button at top. Click refresh triggers SSH monitoring and updates service statuses
result: issue
reported: "clicked on refresh for test 10 got this error: Failed to refresh services - Unable to determine container IP address. DHCP containers require manual IP discovery."
severity: major

### 11. Reveal Service Credentials

expected: In Services tab, click "Show Credentials" on a service card. Credentials expand inline showing username and password with copy-to-clipboard buttons
result: issue
reported: "i cannot test that, i have no services with credentials"
severity: major

### 12. Container Detail Events Tab

expected: Events tab shows chronological timeline with type filter buttons (All, Log, Step, Complete, Error). Each event has color-coded icon, relative timestamp, and expandable metadata section
result: pass

### 13. Filter Events by Type

expected: In Events tab, click filter button (e.g., "Error" or "Step"). Timeline updates to show only events of that type
result: pass

### 14. Lifecycle Actions from Detail Header

expected: Container detail header shows full lifecycle buttons (Start, Shutdown, Stop, Restart, Delete) instead of dropdown. Click any action - destructive ones (Stop, Delete) show AlertDialog confirmation, all show loading state during execution
result: pass

### 15. Shutdown vs Stop Distinction

expected: Running container shows both "Shutdown" and "Stop" buttons. Shutdown is graceful (30s timeout), Stop is forceful. Both show AlertDialog confirmation and update status after completion
result: issue
reported: "only stop shows dialog, shutdown and start execute straight away"
severity: minor

### 16. Detail Page Auto-Refresh

expected: Container detail page has same 30-second auto-refresh with countdown. When countdown hits 0 or "Refresh Now" clicked, all tabs re-fetch data without navigation
result: pass

### 17. Create Container Button Persistence

expected: On dashboard, "Create Container" button is visible in header even when containers exist. Clicking it navigates to /containers/create wizard
result: pass

### 18. Clean Sidebar Navigation

expected: Sidebar shows "Dashboard" and "Templates" items. No redundant "Containers" item (dashboard IS the container view)
result: pass

### 19. Card Loading Indicators Persist

expected: When triggering lifecycle action from dropdown, loading spinner appears next to status badge and remains visible even after dropdown menu closes during operation
result: pass

### 20. Schema Handles Proxmox Booleans

expected: Lifecycle actions (start/stop/restart) work without errors on containers with HA enabled. No schema validation errors in console or toast notifications
result: pass

### 21. Error Logging for Diagnostics

expected: If Proxmox is unreachable or returns errors, check browser console and server logs. Should see descriptive error messages with context (operation, container ID, error details) for debugging
result: pass

## Summary

total: 21
passed: 18
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "Services tab shows service cards with status indicators, web UI links as outline buttons, and 'Refresh Services' button at top. Click refresh triggers SSH monitoring and updates service statuses"
  status: failed
  reason: "User reported: clicked on refresh for test 10 got this error: Failed to refresh services - Unable to determine container IP address. DHCP containers require manual IP discovery."
  severity: major
  test: 10
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "In Services tab, click 'Show Credentials' on a service card. Credentials expand inline showing username and password with copy-to-clipboard buttons"
  status: failed
  reason: "User reported: i cannot test that, i have no services with credentials"
  severity: major
  test: 11
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Running container shows both 'Shutdown' and 'Stop' buttons. Shutdown is graceful (30s timeout), Stop is forceful. Both show AlertDialog confirmation and update status after completion"
  status: failed
  reason: "User reported: only stop shows dialog, shutdown and start execute straight away"
  severity: minor
  test: 15
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
