# Debug Investigation: Service Refresh Fails for DHCP Containers

## Investigation Log

**Date:** 2026-02-12  
**Phase:** 04-container-management  
**Test:** 10 - Container Detail Services Tab  
**Severity:** major

---

## Error Reproduction

**Symptom:**  
Clicking "Refresh Services" button for a DHCP container shows error:

```
Failed to refresh services - Unable to determine container IP address. DHCP containers require manual IP discovery.
```

**Expected Behavior:**  
Refresh should work for both static IP and DHCP containers

---

## Root Cause Analysis

### 1. Trace: Refresh Services Flow

**Entry Point:**  
`apps/dashboard/src/lib/containers/actions.ts:821` - `refreshContainerServicesAction`

**IP Extraction Logic:**

```typescript
// Line 854-872
const config = await getConfig(client, nodeName, vmid);
const net0 = (config as Record<string, unknown>)["net0"] as string | undefined;
if (!net0) {
  throw new ActionError("No network configuration found...");
}

const containerIp = extractIpFromNet0(net0);
if (!containerIp) {
  throw new ActionError(
    "Unable to determine container IP address. DHCP containers require manual IP discovery.",
  );
}
```

### 2. IP Extraction Function Analysis

**File:** `apps/dashboard/src/lib/proxmox/utils.ts:15`

```typescript
export function extractIpFromNet0(net0: string): string | null {
  const ipMatch = net0.match(/ip=([^,/]+)/);
  if (!ipMatch) return null;
  const ip = ipMatch[1];
  if (ip === "dhcp" || ip === "manual") return null; // ← ROOT CAUSE
  return ip;
}
```

**Purpose:** Extract static IP from Proxmox net0 config string like:

- Static: `"name=eth0,bridge=vmbr0,ip=10.0.0.5/24,gw=10.0.0.1"`
- DHCP: `"name=eth0,bridge=vmbr0,ip=dhcp"`

**Issue:** Function correctly identifies `ip=dhcp` but returns `null`, causing refresh to fail.

### 3. Why DHCP Detection Works But Fails

**Container Creation:** `apps/dashboard/src/app/(dashboard)/containers/new/container-wizard.tsx:111`

```typescript
if (configData.dhcp) {
  ipConfig = "ip=dhcp"; // ← Stored in Proxmox config
}
```

**Worker Uses Different Logic:** `apps/dashboard/src/workers/container-creation.ts:121`

```typescript
function extractIpFromConfig(ipConfig: string): string | null {
  const match = ipConfig.match(/ip=(\d+\.\d+\.\d+\.\d+)/); // ← Only matches numeric IPs
  return match ? match[1] : null;
}
```

Worker's `extractIpFromConfig` also returns `null` for DHCP (line 246), but worker **doesn't fail** because it only uses IP for webUrl generation in service discovery - SSH happens via Proxmox host.

### 4. Database Schema Check

**File:** `apps/dashboard/prisma/schema.prisma:153-173`

Container model has:

- `vmid`, `hostname`, `lifecycle`, `rootPassword`
- **NO dedicated IP address field**

The database never stores the actual IP address. It's always fetched from Proxmox config on-demand.

### 5. DHCP IP Discovery Gap

**Where IPs ARE Available:**

1. **During Worker Execution:** Worker connects via Proxmox host using `pct exec` (doesn't need container IP)
2. **Post-Creation:** DHCP containers get IPs assigned by network infrastructure
3. **Proxmox Runtime:** Can query running container for actual assigned IP

**Where IPs ARE NOT Available:**

- **Proxmox Config (`net0`):** Only stores `"ip=dhcp"`, not the actual assigned IP
- **Service Refresh:** Tries to SSH directly to container using config IP (fails for DHCP)

---

## Evidence Summary

### Key Findings

1. **Static IP Path Works:**
   - `net0`: `"ip=10.0.0.5/24,gw=10.0.0.1"`
   - `extractIpFromNet0()` returns `"10.0.0.5"`
   - Refresh succeeds with direct SSH

2. **DHCP Path Fails:**
   - `net0`: `"ip=dhcp"`
   - `extractIpFromNet0()` returns `null`
   - Refresh throws error at line 868-872

3. **Worker Doesn't Fail Because:**
   - Uses Proxmox host SSH + `pct exec` (no direct container IP needed)
   - Only needs IP for webUrl generation (optional)

4. **No Fallback Mechanism:**
   - No code path to query Proxmox for runtime IP
   - No stored IP in database
   - No alternative SSH method for DHCP containers

---

## Files Involved

### Primary Issue

- **`apps/dashboard/src/lib/containers/actions.ts:867-872`**  
  Fails when `extractIpFromNet0()` returns null for DHCP

### IP Extraction Logic

- **`apps/dashboard/src/lib/proxmox/utils.ts:15-21`**  
  Correctly identifies DHCP but returns null (by design for config parsing)

### Related Code Paths

- **`apps/dashboard/src/workers/container-creation.ts:121-125`**  
  Worker's own IP extraction (also fails for DHCP but doesn't block)
- **`apps/dashboard/src/lib/containers/monitoring.ts:371`**  
  `monitorContainer()` requires IP as parameter - can't proceed without it

### Database Schema

- **`apps/dashboard/prisma/schema.prisma:153-173`**  
  Container model has no IP field

---

## Root Cause Statement

**Service refresh fails for DHCP containers because:**

1. Proxmox config stores `"ip=dhcp"` (not the actual assigned IP)
2. `extractIpFromNet0()` correctly returns `null` for DHCP (by design)
3. Refresh action requires IP to SSH directly to container (`monitorContainer()`)
4. No fallback mechanism exists to query Proxmox for runtime-assigned IP
5. No IP is stored in database as cache

**The worker doesn't fail because it uses Proxmox host SSH + `pct exec`, not direct container SSH.**

---

## Suggested Fix Direction

**Option A: Query Proxmox for Runtime IP**

- Add Proxmox API call to get container's actual IP from running state
- Proxmox exposes this via container network interfaces query
- Fallback to this when config shows DHCP

**Option B: Store IP After Assignment**

- Worker discovers assigned IP during deployment
- Store in database (new `ip` field on Container model)
- Use cached IP for refresh operations
- Risk: IP changes if container restarts/network reconfigures

**Option C: Use Proxmox Host SSH Method**

- Replicate worker's approach: SSH to Proxmox host + `pct exec`
- Works for both static and DHCP
- More complex but robust

**Recommendation:** Start with Option A (runtime query) as it's least invasive and handles IP changes automatically.

---

## Next Steps

1. **DO NOT FIX** (per instructions)
2. Research Proxmox API for runtime IP query endpoint
3. Design solution for approval
4. Implement with tests for both static and DHCP scenarios
