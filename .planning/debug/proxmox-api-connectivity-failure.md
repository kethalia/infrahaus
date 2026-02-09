# Debug Session: Proxmox API Connectivity Failure

**Date:** 2026-02-09
**Severity:** blocker
**Phase:** 04-container-management
**Test:** 6 - Container Overview Tab

## Issue Summary

Container detail page shows "Unable to reach Proxmox API" error and displays incomplete data:

- Hostname shows as "—" or "CT 600" instead of actual hostname
- Resource usage shows "Container is stopped or data unavailable"
- Configuration values (hostname, OS template, cores, memory) show as "—"
- Action buttons (Start/Stop/Restart) are missing (only Delete button shows)

## Investigation Findings

### 1. Dashboard vs Detail Page Data Flow

**Dashboard (Working):**

- `getContainersWithStatus()` in data.ts:131-214
- Fetches all containers from all nodes via `listContainers()`
- On Proxmox API failure, sets `proxmoxReachable = false` and continues with DB data
- Returns containers with status "unknown" but still displays them

**Detail Page (Failing):**

- `getContainerDetailData()` in data.ts:220-293
- For "ready" containers, calls `getContainer()` and `getContainerConfig()` (lines 238-240)
- On Proxmox API failure, catches error and sets `proxmoxReachable = false` (line 244)
- Calls `mergeContainerStatus()` with `proxmoxStatus = null` and `proxmoxConfig = null`

### 2. Root Cause: Missing Hostname Fallback

**Problem in `mergeContainerStatus()` function (data.ts:302-377):**

Line 333:

```typescript
const hostname = proxmox?.name ?? null;
```

This ONLY gets hostname from Proxmox, never from the database. The Container database model does NOT have a hostname field - hostname is only stored in Proxmox.

**Status Resolution Issue (lines 310-330):**

```typescript
} else if (!proxmoxReachable) {
  // Proxmox API unreachable — can't determine status
  status = "unknown";
}
```

When Proxmox is unreachable, status becomes "unknown", which breaks the UI:

- container-header.tsx line 58: `isActionable = status === "running" || status === "stopped"`
- With status "unknown", `isActionable = false`
- Action buttons (Start/Shutdown/Stop/Restart) only render when status matches specific values
- Only Delete button shows because it's rendered unconditionally

### 3. Why Dashboard Works

The dashboard calls `listContainers()` which returns a list with basic info including `name` field. Even when Proxmox is unreachable, the dashboard has fallback data from the previous successful fetch or shows "unknown" status gracefully.

The detail page calls `getContainer()` and `getContainerConfig()` which are single-resource API calls that fail completely when Proxmox is unreachable, leaving no data to display.

### 4. Configuration Data Issue

The overview tab displays config data from `container.config` (ProxmoxContainerConfig):

- overview-tab.tsx lines 44-96 reference `config?.hostname`, `config?.cores`, `config?.memory`, etc.
- When Proxmox API fails, `config = null` (set in data.ts:231, never updated in catch block)
- All config fields show "—" because config is null

## Evidence

**File: apps/dashboard/src/lib/containers/data.ts**

Lines 333:

```typescript
const hostname = proxmox?.name ?? null;
```

❌ No fallback to database hostname (doesn't exist in schema)

Lines 324-326:

```typescript
} else if (!proxmoxReachable) {
  status = "unknown";
}
```

❌ "unknown" status breaks UI conditional rendering

Lines 231-244:

```typescript
let proxmoxStatus: ProxmoxContainerStatus | null = null;
let proxmoxConfig: ProxmoxContainerConfig | null = null;
let proxmoxReachable = true;

if (dbContainer.lifecycle === "ready") {
  try {
    const client = await getProxmoxClient();
    const [status, config] = await Promise.all([
      getContainer(client, dbContainer.node.name, dbContainer.vmid),
      getContainerConfig(client, dbContainer.node.name, dbContainer.vmid),
    ]);
    proxmoxStatus = status;
    proxmoxConfig = config;
  } catch {
    proxmoxReachable = false;
  }
}
```

❌ Catch block sets `proxmoxReachable = false` but doesn't provide fallback data

**File: apps/dashboard/src/components/containers/detail/container-header.tsx**

Line 58:

```typescript
const isActionable = status === "running" || status === "stopped";
```

❌ "unknown" status makes `isActionable = false`, disabling all action buttons

Lines 184-225:

```typescript
{status === "stopped" && (
  <Button>Start</Button>
)}

{status === "running" && (
  <>
    <Button>Shutdown</Button>
    <Button>Stop</Button>
    <Button>Restart</Button>
  </>
)}
```

❌ Buttons only render for specific status values, not "unknown"

**File: apps/dashboard/src/components/containers/detail/overview-tab.tsx**

Lines 94-96:

```typescript
<p className="font-medium">
  {container.hostname ?? config?.hostname ?? "—"}
</p>
```

✅ Has fallback logic but `container.hostname` is null (from Proxmox) and `config` is null (API failed)

Lines 120, 128:

```typescript
<p className="font-medium">{config?.cores ?? "—"}</p>
<p className="font-medium">{config?.memory ? `${config.memory} MB` : "—"}</p>
```

❌ Shows "—" when config is null

## Schema Analysis

**File: apps/dashboard/prisma/schema.prisma**

Lines 153-172:

```prisma
model Container {
  id           String             @id @default(cuid())
  vmid         Int                @unique
  lifecycle    ContainerLifecycle @default(creating)
  rootPassword String
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt

  nodeId     String
  node       ProxmoxNode @relation(fields: [nodeId], references: [id])
  templateId String?
  template   Template?   @relation(fields: [templateId], references: [id])

  services ContainerService[]
  events   ContainerEvent[]
}
```

❌ **No `hostname` field in Container model** - hostname is ONLY stored in Proxmox, not the database

## Root Cause (CRITICAL UPDATE)

**ACTUAL Root Cause:** The Proxmox API IS reachable, but `getContainer()` is throwing a Zod validation error because `ha.managed` field returns a number (0 or 1) from Proxmox, but the schema expects a boolean. This error is being caught in the catch block (data.ts:243-244), which sets `proxmoxReachable = false`, misleading the UI to show "Unable to reach Proxmox API".

**Verified via curl:**

```bash
$ curl -k -s -o /dev/null -w "%{http_code}" https://192.168.0.94:8006/api2/json/version
401  # ← Proxmox IS reachable (401 = auth required, as expected)
```

**The Chain of Failure:**

1. User navigates to container detail page
2. `getContainerDetailData()` calls `getContainer()` (data.ts:238)
3. `getContainer()` fetches data from `/nodes/{node}/lxc/{vmid}/status/current`
4. Proxmox returns JSON with `ha: { managed: 0 }` (number)
5. `ContainerStatusSchema` validation fails: expects `boolean`, got `number`
6. Zod throws validation error
7. Catch block (data.ts:243) catches the error and sets `proxmoxReachable = false`
8. UI displays "Unable to reach Proxmox API" (wrong message!)
9. No Proxmox data available → hostname = null, config = null, status = "unknown"

**Secondary Issue:** The application architecture assumes Proxmox API is always available. Container configuration data (hostname, cores, memory, OS template, etc.) is ONLY stored in Proxmox, not cached in the database.

**When Proxmox API fails:**

1. No cached hostname → displays "—" or "CT 600"
2. No cached config → all configuration fields show "—"
3. No cached status → status becomes "unknown"
4. "unknown" status → action buttons don't render
5. No resources data → resource usage section shows error message

**Why Dashboard Works:** Dashboard uses `listContainers()` which fetches minimal data from Proxmox cluster-wide. Even if one node fails, others may succeed. The dashboard also doesn't rely on detailed config data.

**Why Detail Page Fails:** Detail page requires full container config via `getContainer()` and `getContainerConfig()` which are node-specific API calls. When these fail, there's no fallback data source.

## Design Flaw

The current architecture is **stateless** - it doesn't cache Proxmox data in the database. This causes a complete failure when Proxmox is unreachable, even temporarily.

**Implications:**

- Network hiccup → entire detail page breaks
- Proxmox maintenance → application unusable
- High latency → slow page loads
- No offline capabilities

## Files Involved

1. **apps/dashboard/src/lib/containers/data.ts** (lines 220-293, 302-377)
   - `getContainerDetailData()`: No fallback when Proxmox fails
   - `mergeContainerStatus()`: No hostname fallback, sets status to "unknown"

2. **apps/dashboard/src/components/containers/detail/container-header.tsx** (lines 58, 184-225)
   - `isActionable` logic excludes "unknown" status
   - Conditional button rendering based on status

3. **apps/dashboard/src/components/containers/detail/overview-tab.tsx** (lines 44-96, 120, 128)
   - Relies entirely on `config` object from Proxmox
   - Shows "—" for all fields when config is null

4. **apps/dashboard/prisma/schema.prisma** (lines 153-172)
   - Container model lacks hostname and config fields
   - No caching mechanism for Proxmox data

## Suggested Fix Direction

**IMMEDIATE FIX (Required):**

Fix the Zod validation error in `ContainerStatusSchema`:

File: `apps/dashboard/src/lib/proxmox/schemas.ts` (line 142-146)

Change:

```typescript
ha: z.object({
  managed: z.boolean(),  // ← WRONG: Proxmox returns 0/1
}).optional(),
```

To:

```typescript
ha: z.object({
  managed: pveBoolean,  // ← CORRECT: Coerce 0/1 to boolean
}).optional(),
```

This will fix both Test 4 and Test 6 failures.

**LONGER-TERM IMPROVEMENTS:**

**Option 1: Cache Proxmox Data in Database (Recommended)**

- Add `hostname`, `cores`, `memory`, `ostype`, etc. to Container model
- Update these fields when container is created or Proxmox data is fetched
- Use database as source of truth, Proxmox as live status update
- Graceful degradation when Proxmox is unreachable

**Option 2: Better Error Handling**

- Store last known status in database
- Display last known values with "stale data" warning
- Keep action buttons available with "may fail" warning

**Option 3: Hybrid Approach**

- Cache essential fields (hostname, cores, memory) in database
- Fetch live status from Proxmox on-demand
- Show cached data + "live data unavailable" message

**Related Gaps:**

- Test 4: Lifecycle actions fail (SAME root cause: ha.managed Zod validation error)
- Test 5: Header missing hostname and buttons (SAME root cause: ha.managed Zod validation error)
- Test 6: Overview tab shows connectivity error (SAME root cause: ha.managed Zod validation error)
- Tests 7-15: Blocked by this issue

**All failures trace back to the same bug:** `ContainerStatusSchema.ha.managed` expects boolean but Proxmox returns number.

## Next Steps for Fixing

1. Decide on caching strategy (Option 1 recommended)
2. Update Prisma schema to add config cache fields
3. Update container creation flow to save config to database
4. Update data.ts to use cached data as fallback
5. Add periodic sync job to update cached data from Proxmox
6. Update UI to show data staleness indicator
