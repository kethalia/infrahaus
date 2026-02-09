# Debug Session: Container Lifecycle Actions - Zod Validation Error

**Issue:** Container lifecycle actions fail with ProxmoxError: `ha.managed expects boolean but receives number`

**Date:** 2026-02-09  
**Test:** UAT Phase 04, Test 4 - Container Lifecycle Actions from Dashboard  
**Severity:** Blocker

---

## Investigation Summary

The container lifecycle action (Stop action specifically, based on stack trace line 629) fails when validating the Proxmox API response for container status. The Zod schema expects `ha.managed` to be a boolean, but Proxmox returns it as a number (0 or 1).

---

## Root Cause

**Proxmox API returns boolean values as integers (0/1), but the Zod schema expects boolean type**

### Evidence

1. **Error Message:**

   ```
   Zod validation error - ha.managed expects boolean but receives number from Proxmox API
   [
     {
       "expected": "boolean",
       "code": "invalid_type",
       "path": ["ha", "managed"],
       "message": "Invalid input: expected boolean, received number"
     }
   ]
   ```

2. **Stack Trace:**
   - `ProxmoxClient.request` (src/lib/proxmox/client.ts:188) throws error after retries
   - Called from `actions.ts:629` which calls `getContainer(client, nodeName, vmid)`
   - `getContainer` validates response with `ContainerStatusSchema`

3. **Schema Definition (src/lib/proxmox/schemas.ts:142-146):**

   ```typescript
   ha: z
     .object({
       managed: z.boolean(),  // ❌ Expects boolean type
     })
     .optional(),
   ```

4. **Proxmox API Behavior:**
   - Proxmox VE API commonly returns boolean values as integers: 0 = false, 1 = true
   - This is a known Proxmox API pattern (see Storage fields)

5. **Existing Pattern in Codebase (schemas.ts:191):**

   ```typescript
   const pveBoolean = z.union([z.boolean(), z.number()]).transform((v) => !!v);
   ```

   - Already used for storage fields: `shared`, `active`, `enabled`
   - Handles both boolean and number inputs from Proxmox

6. **Other Boolean Fields at Risk:**
   The following fields in schemas also use `z.boolean()` and may have similar issues:
   - `ContainerSchema.template` (line 91)
   - `ContainerConfigSchema.console` (line 100)
   - `ContainerConfigSchema.onboot` (line 111)
   - `ContainerConfigSchema.protection` (line 113)
   - `ContainerConfigSchema.template` (line 119)
   - `ContainerConfigSchema.unprivileged` (line 121)

---

## Files Involved

### Primary Issue

- **apps/dashboard/src/lib/proxmox/schemas.ts:144**
  - `ha.managed` field expects `z.boolean()` but Proxmox returns number
  - Should use `pveBoolean` helper instead

### Related Files

- **apps/dashboard/src/lib/containers/actions.ts:629**
  - Calls `getContainer()` which triggers validation failure
  - All lifecycle actions (stop, start, restart) call this for status check

- **apps/dashboard/src/lib/proxmox/containers.ts:83-91**
  - `getContainer()` function uses `ContainerStatusSchema` for validation
  - Called by all container lifecycle actions

- **apps/dashboard/src/lib/proxmox/client.ts:188**
  - Throws ProxmoxError when schema validation fails after retries
  - Validation happens before returning response to caller

---

## Additional Boolean Fields to Review

These fields should also be reviewed for the same issue:

1. `template` field in ContainerSchema
2. `console`, `onboot`, `protection`, `template`, `unprivileged` in ContainerConfigSchema

These may not be causing errors **currently** because:

- They're marked `.optional()` so Proxmox may not always return them
- They may not be present in responses for the specific test container being used
- The `ha.managed` field is only present when HA is configured on the cluster

---

## Fix Direction

1. **Immediate Fix:** Change `ha.managed` from `z.boolean()` to `pveBoolean`
2. **Comprehensive Fix:** Audit all `z.boolean()` fields in Proxmox schemas and replace with `pveBoolean` where Proxmox API may return 0/1
3. **Pattern:** Use the existing `pveBoolean` helper consistently for all Proxmox boolean fields

---

## Testing Notes

- Issue occurs when container has HA configuration (`ha.managed` field present in API response)
- Confirmation dialog works correctly - issue only happens during action execution
- All lifecycle actions that check container status will fail with same error
- May affect: Stop, Start, Restart actions (all call `getContainer` for validation)
