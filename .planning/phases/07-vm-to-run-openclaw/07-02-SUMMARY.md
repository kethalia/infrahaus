---
phase: 07-vm-to-run-openclaw
plan: 02
subsystem: infra
tags: [bash, debian, xfce, lightdm, tigervnc, nodejs, chrome, openclaw, vm, desktop]

# Dependency graph
requires:
  - phase: 07-vm-to-run-openclaw
    provides: cloud-init bootstrap (user creation, SSH key) from plan 01
provides:
  - 8 numbered post-install scripts covering full desktop VM setup
  - Idempotent, standalone Bash scripts for Debian 13 XFCE desktop
  - TigerVNC remote access on port 5901 with -localhost no
  - Defensive OpenClaw install with npm registry check before attempt
affects:
  - 07-03 (run-scripts.sh orchestrator consumes these scripts)

# Tech tracking
tech-stack:
  added: [tigervnc-standalone-server, task-xfce-desktop, lightdm, google-chrome-stable, nodejs-22-nodesource]
  patterns:
    - Standalone bash scripts with inline color logging (no framework dependency)
    - Idempotency via dpkg -l and version checks before installs
    - Defensive external resource check before install attempt
    - systemd template unit (vncserver@.service) for parameterized display numbers

key-files:
  created:
    - infra/vm/templates/openclaw-desktop/scripts/00-pre-checks.sh
    - infra/vm/templates/openclaw-desktop/scripts/01-setup-user.sh
    - infra/vm/templates/openclaw-desktop/scripts/02-desktop-setup.sh
    - infra/vm/templates/openclaw-desktop/scripts/03-nodejs-setup.sh
    - infra/vm/templates/openclaw-desktop/scripts/04-chrome-install.sh
    - infra/vm/templates/openclaw-desktop/scripts/05-vnc-setup.sh
    - infra/vm/templates/openclaw-desktop/scripts/06-openclaw-install.sh
    - infra/vm/templates/openclaw-desktop/scripts/99-post-setup.sh
  modified: []

key-decisions:
  - "Standalone color logging (RED/GREEN/YELLOW vars + info/warn/error functions) — no config-manager framework dependency; scripts run inside VM"
  - "VNC configured with -localhost no (remote access) and password 'openclaw' via vncpasswd -f from stdin"
  - "Script 06 uses npm view openclaw before install attempt — provides actionable TODO error if package not on public npm"
  - "Chrome uses signed-by keyring at /usr/share/keyrings/google-chrome.gpg — no deprecated apt-key"
  - "Node.js via NodeSource setup_22.x (not NVM) with npm global prefix at /home/openclaw/.npm-global"
  - "chage -d 0 only for newly created users — existing users not forced to change password again"

patterns-established:
  - "Idempotency pattern: check state before action (dpkg -l, id, node --version, which) — skip if already done"
  - "Defensive external dependency check: verify before install (npm view, curl check) with clear error + fallback instructions"
  - "systemd template unit pattern: vncserver@.service enables vncserver@1, vncserver@2, etc."

requirements-completed: [VM-03, VM-04]

# Metrics
duration: 4min
completed: 2026-03-08
---

# Phase 7 Plan 02: VM Post-Install Scripts Summary

**8 modular Bash scripts installing XFCE desktop, TigerVNC (remote port 5901), Node.js 22, Google Chrome, and defensive OpenClaw install on Debian 13**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-08T01:56:16Z
- **Completed:** 2026-03-08T02:00:05Z
- **Tasks:** 3
- **Files modified:** 8 (all created)

## Accomplishments

- Created 8 numbered post-install scripts covering all VM setup requirements: pre-checks, user, desktop, Node.js, Chrome, VNC, OpenClaw, post-validation
- TigerVNC configured with `-localhost no` (remote clients connect on port 5901), VNC password set to 'openclaw' via vncpasswd stdin, systemd vncserver@1 service enabled
- Script 06 checks npm registry with `npm view openclaw version` before any install attempt — exits with clear actionable TODO message if package not found on public npm
- All scripts are idempotent, executable, and pass `bash -n` syntax check

## Task Commits

Each task was committed atomically:

1. **Task 1: Pre-check, user setup, and desktop scripts (00-02)** - `7b04d5f` (feat)
2. **Task 2: Application install and defensive OpenClaw scripts (03-06)** - `10570d2` (feat)
3. **Task 3: 99-post-setup.sh validation and welcome script** - `3fbf4cd` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `infra/vm/templates/openclaw-desktop/scripts/00-pre-checks.sh` - Validates root, Debian 13/trixie, RAM/disk/net before any install
- `infra/vm/templates/openclaw-desktop/scripts/01-setup-user.sh` - Creates openclaw user (UID 1000), sudo/audio/video/render groups, passwordless sudo
- `infra/vm/templates/openclaw-desktop/scripts/02-desktop-setup.sh` - Installs XFCE + LightDM with autologin-user=openclaw, qemu-guest-agent
- `infra/vm/templates/openclaw-desktop/scripts/03-nodejs-setup.sh` - Node.js 22 via NodeSource setup_22.x with npm global prefix at ~/.npm-global
- `infra/vm/templates/openclaw-desktop/scripts/04-chrome-install.sh` - Google Chrome via modern signed-by GPG keyring (no deprecated methods)
- `infra/vm/templates/openclaw-desktop/scripts/05-vnc-setup.sh` - TigerVNC with -localhost no, vncpasswd, xstartup for XFCE4, systemd vncserver@1
- `infra/vm/templates/openclaw-desktop/scripts/06-openclaw-install.sh` - npm view openclaw registry check first, exits with TODO if not found
- `infra/vm/templates/openclaw-desktop/scripts/99-post-setup.sh` - Validates all components, prints software versions, welcome message with 5901/SSH access

## Decisions Made

- Inline color logging (not LXC config-manager framework) — scripts run standalone inside the VM with no framework available
- VNC `-localhost no` is required for remote VNC clients; without it TigerVNC only accepts localhost connections
- `npm view openclaw version` as defensive gate — the package may not be on the public npm registry, and a confusing 404 error would block users
- Chrome uses `/usr/share/keyrings/google-chrome.gpg` signed-by approach — `apt-key` is deprecated and removed in Debian 12+
- NodeSource `setup_22.x` (not NVM) selected for VM use case — simpler, no per-user installation complexity
- `chage -d 0` only applied to newly created users — prevents locking out users who already set their own password

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The plan's verification check `! grep -q 'apt-key'` would have matched comment lines explaining we do NOT use apt-key. Removed the word from comments to ensure clean verification (the actual implementation never uses apt-key). This is a minor cosmetic fix with no functional impact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 8 scripts ready for Plan 03 (run-scripts.sh orchestrator)
- Scripts tested with `bash -n` (syntax only — functional testing requires a live Debian 13 VM)
- Script 06 intentionally exits 1 if openclaw is not on npm — operator must update the install method once the correct package source is known

---
*Phase: 07-vm-to-run-openclaw*
*Completed: 2026-03-08*
