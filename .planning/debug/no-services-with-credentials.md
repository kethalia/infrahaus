# Debug Investigation: No Services with Credentials Available

**Phase:** 04-container-management  
**Test:** 11 - Reveal Service Credentials  
**Severity:** major  
**Status:** Root cause identified  
**Investigator:** opencode  
**Date:** 2026-02-12

---

## Root Cause

**MISMATCH IN CREDENTIAL STORAGE FORMAT**

The template installation scripts save credentials to a **single file** (`/etc/infrahaus/credentials`), but the monitoring code expects credentials in **separate files** within a **directory** (`/etc/infrahaus/credentials/`).

### Evidence

1. **Credential Creation (Template Scripts)**
   - Location: `infra/lxc/scripts/config-manager/config-manager-helpers.sh:338-359`
   - Function: `save_credential()`
   - Format: Single file `/etc/infrahaus/credentials` with `KEY=VALUE` format
   - Example usage:
     ```bash
     save_credential "CODE_SERVER_PASSWORD" "$CODE_SERVER_PASSWORD"
     save_credential "FILEBROWSER_USERNAME" "$FILEBROWSER_USERNAME"
     save_credential "FILEBROWSER_PASSWORD" "$FILEBROWSER_PASSWORD"
     ```
   - Result: Creates `/etc/infrahaus/credentials` (file, not directory)

2. **Credential Reading (Monitoring Code)**
   - Location: `apps/dashboard/src/lib/containers/monitoring.ts:213-270`
   - Function: `readCredentials()`
   - Format: Expects `/etc/infrahaus/credentials/` (directory with trailing slash)
   - Behavior:
     ```typescript
     const CREDENTIALS_DIR = "/etc/infrahaus/credentials/";
     lsResult = await ssh.exec(
       `ls ${CREDENTIALS_DIR} 2>/dev/null || echo '__EMPTY__'`,
     );
     // Lists FILES in the directory
     for (const file of files) {
       catResult = await ssh.exec(
         `cat "${CREDENTIALS_DIR}${file}" 2>/dev/null`,
       );
       // Parses each file as service-specific credentials
     }
     ```
   - Result: Lists directory contents, expects separate files like:
     - `/etc/infrahaus/credentials/code-server.json`
     - `/etc/infrahaus/credentials/filebrowser.env`
     - `/etc/infrahaus/credentials/opencode.txt`

3. **Constants Definition**
   - Location: `apps/dashboard/src/lib/constants/infrastructure.ts:62`
   - Constant: `export const CREDENTIALS_DIR = "/etc/infrahaus/credentials/";`
   - Comment: "Directory where per-service credential files are stored inside containers"

### Why Test 11 Failed

1. **Test 10 blocks Test 11:** Service refresh fails due to DHCP IP detection issue (separate bug)
2. **Even if Test 10 worked:** Credentials would NOT be discovered because:
   - Template creates `/etc/infrahaus/credentials` (a file)
   - Monitoring reads `/etc/infrahaus/credentials/` (a directory)
   - `ls /etc/infrahaus/credentials/` fails → returns `__EMPTY__`
   - No credentials are parsed → `service.credentials` is `null`
   - UI never shows "Show Credentials" button

### Cascade Dependency

This issue is **partially blocked** by Test 10:

- Without container IP, service refresh cannot SSH into container
- Without SSH access, cannot verify credential file/directory structure
- However, static code analysis confirms the format mismatch exists regardless

---

## Files Involved

### Template Installation (Creates File)

1. `infra/lxc/scripts/config-manager/config-manager-helpers.sh:338-359`
   - Defines `save_credential()` function
   - Creates `/etc/infrahaus/credentials` as a single file
   - Appends all credentials in `KEY=VALUE` format

2. Service installation scripts (call save_credential):
   - `infra/lxc/templates/web3-dev/container-configs/scripts/50-vscode-server.sh:78`
   - `infra/lxc/templates/web3-dev/container-configs/scripts/51-filebrowser.sh:85-86`
   - `infra/lxc/templates/web3-dev/container-configs/scripts/52-opencode.sh:61`

### Monitoring Code (Expects Directory)

1. `apps/dashboard/src/lib/containers/monitoring.ts:213-270`
   - Function: `readCredentials()`
   - Expects directory with separate files per service
   - Parses filename as service name (strips `.json`, `.txt`, `.env` extensions)

2. `apps/dashboard/src/lib/constants/infrastructure.ts:62`
   - Defines `CREDENTIALS_DIR` with trailing slash (indicates directory)

### Display Code (Dependent on Monitoring)

1. `apps/dashboard/src/lib/containers/actions.ts:878-933`
   - `refreshContainerServicesAction` calls `monitorContainer()`
   - Maps `result.credentials` to service records
   - Encrypts and stores in database

2. `apps/dashboard/src/components/containers/detail/services-tab.tsx:187-228`
   - ServiceCard component shows credentials UI
   - Only renders if `service.credentials && Object.keys(service.credentials).length > 0`
   - Never triggers because credentials are null

---

## Suggested Fix Direction

**Option A: Change Template to Create Separate Files (Recommended)**

- Modify `save_credential()` to create `/etc/infrahaus/credentials/<service>.env` files
- Pass service name as parameter: `save_credential "code-server" "PASSWORD" "$CODE_SERVER_PASSWORD"`
- Preserves monitoring code's per-service credential model
- Aligns with comment in constants: "per-service credential files"

**Option B: Change Monitoring to Read Single File**

- Modify `readCredentials()` to read `/etc/infrahaus/credentials` as a file
- Parse all `KEY=VALUE` pairs
- Map keys to services (e.g., `CODE_SERVER_PASSWORD` → service: `code-server`)
- Requires logic to infer service name from credential key prefix

**Recommendation:** Option A. The monitoring code's approach is more flexible (supports multiple credential formats per service: JSON, env, plain text). The template scripts only need minor changes to write separate files.

---

## Next Steps

1. **Wait for Test 10 fix** (DHCP IP detection) to unblock service refresh
2. **Choose fix approach** (Option A vs B)
3. **Implement chosen fix**
4. **Test credential discovery** on a running container with services
5. **Verify UI** shows "Show Credentials" button and displays credentials correctly

---

## Investigation Log

### Step 1: Understand Test 11 Symptom

- User reports: "i cannot test that, i have no services with credentials"
- Test 11 expects: Click "Show Credentials" → see username/password with copy buttons
- Blocked by: Test 10 failure (service refresh fails)

### Step 2: Verify Cascade Dependency

- Checked if Test 11 is purely blocked by Test 10 or has separate bug
- Reviewed service refresh flow: `refreshContainerServicesAction` → `monitorContainer` → `readCredentials`

### Step 3: Trace Credential Discovery

- Found `readCredentials()` in `monitoring.ts:213-270`
- Discovered it lists files in `/etc/infrahaus/credentials/` directory
- Parses each file as service-specific credentials

### Step 4: Trace Credential Creation

- Searched templates for credential creation: `grep -rn "save_credential"`
- Found `save_credential()` function in `config-manager-helpers.sh:338-359`
- Discovered it writes to `/etc/infrahaus/credentials` file (not directory)

### Step 5: Confirm Mismatch

- Compared constants: `CREDENTIALS_DIR = "/etc/infrahaus/credentials/"` (with trailing slash)
- Confirmed comment: "per-service credential files" (plural, indicates directory)
- Identified format mismatch: single file vs. directory of files

### Step 6: Verify UI Logic

- Checked `services-tab.tsx:187-228` for credential display
- Confirmed UI only shows credentials if `service.credentials` is non-null object
- Traced back to actions: credentials populated from `result.credentials` (monitoring output)

### Step 7: Assess Cascade Impact

- Test 10 blocks SSH access → cannot run monitoring → cannot discover credentials
- BUT: Even if Test 10 fixed, credentials would not be found due to format mismatch
- Conclusion: Separate bug, but currently masked by Test 10 failure

---

## Conclusion

**Root Cause:** Template installation creates `/etc/infrahaus/credentials` as a single file, but monitoring expects `/etc/infrahaus/credentials/` as a directory with separate per-service files.

**Evidence:** Code paths confirmed in 6 files (3 template scripts, 3 monitoring/display files).

**Fix Strategy:** Modify template's `save_credential()` function to write separate files per service in the credentials directory.

**Dependencies:** Test 10 must be fixed first to enable service refresh and credential discovery testing.
