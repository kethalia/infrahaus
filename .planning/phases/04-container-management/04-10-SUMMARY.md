---
phase: 04-container-management
plan: 10
subsystem: infra
tags: [lxc, credentials, monitoring, config-manager, bash]

# Dependency graph
requires:
  - phase: 04-02
    provides: Service monitoring engine with credential discovery
  - phase: 04-04
    provides: Container detail page with credential reveal UI
provides:
  - Per-service credential files in /etc/infrahaus/credentials/{service}.env format
  - Updated save_credential() function accepting service name parameter
  - Discoverable credential format matching monitoring expectations
affects: [05-web-ui-monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Per-service credential files pattern (/etc/infrahaus/credentials/{service}.env)

key-files:
  created: []
  modified:
    - infra/lxc/scripts/config-manager/config-manager-helpers.sh
    - infra/lxc/templates/web3-dev/container-configs/scripts/50-vscode-server.sh
    - infra/lxc/templates/web3-dev/container-configs/scripts/51-filebrowser.sh
    - infra/lxc/templates/web3-dev/container-configs/scripts/52-opencode.sh

key-decisions:
  - "Updated credential storage from single file to directory with per-service files"
  - "Service names match template service definitions (code-server, filebrowser, opencode)"

patterns-established:
  - "Credential files named {service-name}.env in /etc/infrahaus/credentials/"
  - "save_credential function signature: save_credential service_name key value"

# Metrics
duration: 1 min
completed: 2026-02-16
---

# Phase 04 Plan 10: Credential Discovery Fix Summary

**Per-service credential files created during template installation, enabling dashboard credential discovery and display**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-16T14:04:59Z
- **Completed:** 2026-02-16T14:06:18Z
- **Tasks:** 1/1
- **Files modified:** 4

## Accomplishments

- Updated `save_credential()` function to create per-service credential files
- Changed credential storage from single `/etc/infrahaus/credentials` file to `/etc/infrahaus/credentials/{service}.env` directory structure
- Updated all template script callsites to pass service name parameter
- Enabled credential discovery by monitoring code matching `CREDENTIALS_DIR` constant expectation

## Task Commits

Each task was committed atomically:

1. **Task 1: Update save_credential() to create per-service credential files** - `f38130f` (fix)

**Plan metadata:** Not yet committed (will be committed with STATE.md update)

## Files Created/Modified

- `infra/lxc/scripts/config-manager/config-manager-helpers.sh` - Updated save_credential() function signature and implementation
- `infra/lxc/templates/web3-dev/container-configs/scripts/50-vscode-server.sh` - Updated save_credential call to include "code-server" service name
- `infra/lxc/templates/web3-dev/container-configs/scripts/51-filebrowser.sh` - Updated 2 save_credential calls to include "filebrowser" service name
- `infra/lxc/templates/web3-dev/container-configs/scripts/52-opencode.sh` - Updated save_credential call to include "opencode" service name

## Decisions Made

**Credential file format:**

- Chose per-service `.env` files over single aggregated file to match monitoring code expectations
- Service names use lowercase with hyphens (code-server, not CODE_SERVER or vscode-server) to match systemd service naming conventions
- File extension `.env` chosen for clarity (alternatives .txt, .conf, .json also supported by monitoring parser)

**Why this approach:**

- Monitoring code expects directory listing via `ls /etc/infrahaus/credentials/` (line 219 of monitoring.ts)
- Dashboard credential reveal already implemented server-side decryption (04-04)
- Per-service files enable granular credential management and discovery
- Preserves KEY=VALUE format compatibility with existing parsing logic

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness

**Testing constraint:** This fix requires NEW container creation to take effect. Existing containers have old credential format (single file) and won't be retroactively fixed.

**Testing path:**

1. Create new container from web3-dev template (after Phase 04 gap closure complete)
2. SSH into container and verify:
   - `/etc/infrahaus/credentials/` is a directory (not file)
   - Contains `code-server.env`, `filebrowser.env`, `opencode.env`
   - Each file contains KEY=VALUE credentials
3. In dashboard: refresh services, verify "Show Credentials" button appears
4. Click button, verify credentials expand with copy buttons

**Dependency:** Gap 1 (DHCP service refresh) must be fixed before credentials can be discovered via monitoring.

**Ready for:** Gap 3 (Confirmation dialogs) - final gap closure item in Phase 04

---

_Phase: 04-container-management_
_Completed: 2026-02-16_

## Self-Check: PASSED

All files and commits verified:
- ✓ All 4 modified files exist
- ✓ Commit f38130f exists in git history
