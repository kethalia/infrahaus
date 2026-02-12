# Debug Investigation: Missing Confirmation Dialogs for Shutdown

**Date:** 2026-02-12  
**Severity:** Minor  
**Status:** Root cause identified

---

## Summary

Shutdown and Start buttons execute immediately without confirmation dialogs, while Stop and Delete show AlertDialog confirmation prompts.

---

## Investigation Log

### 1. Located Component File

**File:** `apps/dashboard/src/components/containers/detail/container-header.tsx`

This component renders the container detail page header with all action buttons (Start, Shutdown, Stop, Restart, Delete).

### 2. Analyzed State Management

**Lines 61-63:**

```typescript
const [confirmDialog, setConfirmDialog] = useState<"stop" | "delete" | null>(
  null,
);
```

**Finding:** The `confirmDialog` state only supports two values: `"stop"` and `"delete"`. There is no support for `"shutdown"` or `"start"` confirmation dialogs.

### 3. Compared Button Implementations

#### Stop Button (Lines 244-254)

```typescript
onClick={() => setConfirmDialog("stop")}
```

- Opens confirmation dialog
- Dialog rendered at lines 314-335
- Only executes `handleStop()` after confirmation

#### Delete Button (Lines 291-299)

```typescript
onClick={() => setConfirmDialog("delete")}
```

- Opens confirmation dialog
- Dialog rendered at lines 337-362
- Only executes `handleDelete()` after confirmation

#### Shutdown Button (Lines 220-230)

```typescript
onClick = { handleShutdown };
```

- **Executes immediately without confirmation**
- No dialog state value for shutdown
- No AlertDialog component rendered

#### Start Button (Lines 197-206)

```typescript
onClick = { handleStart };
```

- **Executes immediately without confirmation**
- No dialog state value for start
- No AlertDialog component rendered

### 4. Verified Handler Implementation

**Lines 142-162:**

- `handleStart()` - directly calls `executeStart()`
- `handleShutdown()` - directly calls `executeShutdown()`
- `handleStop()` - calls `setConfirmDialog(null)` then `executeStop()` (invoked from AlertDialog)
- `handleDelete()` - calls `setConfirmDialog(null)` then `executeDelete()` (invoked from AlertDialog)

---

## Root Cause

**The `confirmDialog` state and AlertDialog components were never implemented for Shutdown and Start actions.**

This is a missing feature, not a regression. The state type was explicitly defined as:

```typescript
"stop" | "delete" | null;
```

This excludes `"shutdown"` and `"start"` from the confirmation flow.

---

## Evidence Summary

| Action   | Confirmation | Handler Invocation     | AlertDialog Exists |
| -------- | ------------ | ---------------------- | ------------------ |
| Start    | ❌ None      | Direct from `onClick`  | ❌ No              |
| Shutdown | ❌ None      | Direct from `onClick`  | ❌ No              |
| Stop     | ✅ Yes       | Via AlertDialog action | ✅ Yes (L314-335)  |
| Restart  | ❌ None      | Direct from `onClick`  | ❌ No              |
| Delete   | ✅ Yes       | Via AlertDialog action | ✅ Yes (L337-362)  |

---

## Files Involved

1. **`apps/dashboard/src/components/containers/detail/container-header.tsx`**
   - Line 61-63: `confirmDialog` state missing "shutdown" and "start" values
   - Line 142-143: `handleStart()` executes immediately
   - Line 151-153: `handleShutdown()` executes immediately
   - Line 197-206: Start button onClick calls handler directly
   - Line 220-230: Shutdown button onClick calls handler directly
   - Missing: AlertDialog components for shutdown and start

---

## Suggested Fix Direction

**Expand confirmation system to include Shutdown and Start:**

1. Update state type: `"stop" | "delete" | "shutdown" | "start" | null`
2. Change button onClick handlers to set dialog state instead of direct execution
3. Add two new AlertDialog components (similar to Stop/Delete pattern)
4. Shutdown dialog should emphasize "graceful shutdown with 30s timeout"
5. Start dialog can be simpler (less destructive action)

**Alternatively (less intrusive):**

- Only add confirmation for Shutdown (destructive action)
- Keep Start immediate (non-destructive, matches Restart pattern)
