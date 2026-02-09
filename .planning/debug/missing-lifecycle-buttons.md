---
issue: Missing lifecycle buttons in container detail header
phase: 04-container-management
test: 5
severity: major
investigated: 2026-02-09
---

# Root Cause: Status "unknown" and Missing Hostname from Proxmox Data

## Issue Summary

User reports that the container detail page header shows:

- Only "CT 600" as title (not the hostname "test-container")
- Only the Delete button (missing Start/Shutdown/Stop/Restart buttons)

## Investigation Findings

### 1. Hostname Display Issue

**File:** `apps/dashboard/src/lib/containers/data.ts:333`

```typescript
// Extract hostname from Proxmox data or fallback
const hostname = proxmox?.name ?? null;
```

**Problem:** Hostname is extracted exclusively from Proxmox live data, not from the database. When Proxmox API is unreachable or fails to return data, `hostname` becomes `null`.

**Evidence:** User sees "CT 600" in header, which is the fallback display name when hostname is null:

- `apps/dashboard/src/components/containers/detail/container-header.tsx:57`

```typescript
const displayName = hostname ?? `CT ${vmid}`;
```

### 2. Missing Lifecycle Buttons Issue

**File:** `apps/dashboard/src/lib/containers/data.ts:324-330`

```typescript
} else if (!proxmoxReachable) {
  // Proxmox API unreachable — can't determine status
  status = "unknown";
} else {
  // Proxmox reachable but container not found — likely deleted externally
  status = "unknown";
}
```

When Proxmox API is unreachable, the container status is set to `"unknown"`.

**File:** `apps/dashboard/src/components/containers/detail/container-header.tsx:58`

```typescript
const isActionable = status === "running" || status === "stopped";
```

The `isActionable` flag is only `true` when status is "running" or "stopped". When status is "unknown", `isActionable` is `false`.

**File:** `apps/dashboard/src/components/containers/detail/container-header.tsx:184-225`

Conditional rendering of lifecycle buttons:

- Start button: only shown when `status === "stopped"` (line 184)
- Shutdown/Stop/Restart buttons: only shown when `status === "running"` (line 195)
- Delete button: always shown, but disabled when `!isActionable` (line 231)

**Result:** When status is "unknown", none of the Start/Shutdown/Stop/Restart buttons render. Only the Delete button renders (though it's disabled).

### 3. Related UAT Findings

**Test 6 (Overview Tab):** User reported seeing this message:

> "Unable to reach Proxmox API. Live status and resource data may be stale. Actions may not work until connectivity is restored."

This confirms that `proxmoxReachable === false` during testing, which explains both issues:

1. Hostname becomes `null` because Proxmox data is unavailable
2. Status becomes "unknown" because Proxmox is unreachable

## Root Cause Chain

```
Proxmox API unreachable
  ↓
proxmoxReachable = false (data.ts:244)
  ↓
proxmox = null (data.ts:229)
  ↓
Two consequences:
1. hostname = proxmox?.name ?? null = null (data.ts:333)
   → Display shows "CT 600" instead of hostname (container-header.tsx:57)

2. status = "unknown" (data.ts:326)
   → isActionable = false (container-header.tsx:58)
   → Start/Shutdown/Stop/Restart buttons don't render (container-header.tsx:184-225)
   → Only Delete button renders (container-header.tsx:227)
```

## Files Involved

1. **apps/dashboard/src/lib/containers/data.ts**
   - Line 333: Hostname extracted only from Proxmox data, no DB fallback
   - Lines 324-330: Status set to "unknown" when Proxmox unreachable
   - Line 338: Hostname assigned to merged container data

2. **apps/dashboard/src/components/containers/detail/container-header.tsx**
   - Line 57: Display name defaults to "CT {vmid}" when hostname is null
   - Line 58: isActionable only true for "running" or "stopped" status
   - Lines 184-225: Lifecycle buttons conditionally rendered based on status
   - Line 231: Delete button disabled when !isActionable

3. **apps/dashboard/src/app/(dashboard)/containers/[id]/container-detail.tsx**
   - Lines 30-35: Passes container data to ContainerHeader
   - Lines 38-45: Shows warning when proxmoxReachable is false

## Expected vs Actual Behavior

### Expected (per 04-04-PLAN.md)

- Header shows hostname and lifecycle action buttons
- "Lifecycle action buttons (full buttons, not dropdown) appear in the page header"
- Buttons should be functional regardless of Proxmox connectivity issues

### Actual

- Header shows "CT 600" instead of hostname
- Only Delete button appears (and it's disabled)
- User cannot perform any lifecycle actions

## Suggested Fix Direction

### Fix 1: Hostname Fallback (Priority: High)

Store hostname in database during container creation, then modify `mergeContainerStatus()` to:

```typescript
const hostname = proxmox?.name ?? db.hostname ?? null;
```

### Fix 2: Allow Actions When Proxmox Unreachable (Priority: Medium)

Consider whether lifecycle actions should be:

- **Option A:** Always show buttons, but actions fail gracefully with toast error
  - Rationale: User can attempt action; if Proxmox reconnects, it works
  - Implementation: Remove status-based conditional rendering, rely on action error handling
- **Option B:** Show buttons in disabled state with tooltip explaining Proxmox unreachable
  - Rationale: Clear user feedback about why actions unavailable
  - Implementation: Render all buttons, disable when status === "unknown", add tooltip
- **Option C:** Keep current behavior but improve UX with clear messaging
  - Rationale: Prevent users from attempting actions that will fail
  - Implementation: Add alert above header explaining actions unavailable during connectivity issues

### Fix 3: Status Detection Improvement (Priority: Low)

Consider storing last known status in database and using as fallback:

```typescript
const status = determineStatus(
  db.lifecycle,
  proxmox?.status,
  db.lastKnownStatus,
  proxmoxReachable,
);
```

## Notes

- The Proxmox connectivity issue is a separate blocker (Test 4 blocker)
- Even after Proxmox connectivity is restored, the hostname issue would persist if hostname is not stored in DB
- Current implementation makes lifecycle controls completely dependent on Proxmox connectivity
- No database field currently exists for storing hostname (would require schema migration)
