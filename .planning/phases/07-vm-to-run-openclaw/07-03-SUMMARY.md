---
phase: 07-vm-to-run-openclaw
plan: "03"
subsystem: infra
tags: [bash, vm, proxmox, ssh, scp, desktop, readme, openclaw]

# Dependency graph
requires:
  - phase: 07-vm-to-run-openclaw
    provides: cloud-init bootstrap (openclaw user, SSH, passwordless sudo) from plan 01
  - phase: 07-vm-to-run-openclaw
    provides: 8 numbered post-install scripts from plan 02
provides:
  - infra/vm/templates/openclaw-desktop/run-scripts.sh — SSH orchestrator with root/openclaw fallback
  - infra/vm/templates/openclaw-desktop/README.md — Complete template documentation
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SSH user detection pattern: try root first, fall back to named user with NOPASSWD sudo
    - SCP bulk copy then SSH exec pattern for remote script orchestration
    - Single-script mode for idempotent re-runs of individual components

key-files:
  created:
    - infra/vm/templates/openclaw-desktop/run-scripts.sh
    - infra/vm/templates/openclaw-desktop/README.md
  modified: []

key-decisions:
  - "SSH fallback order: root first (most privileged, simplest), then openclaw with SUDO_PREFIX=sudo"
  - "SCP_CMD strips -o BatchMode=yes (not compatible with scp arg parsing) by string substitution"
  - "Cleanup via ssh rm -rf always succeeds (|| true) — non-critical if VM rebooted between runs"
  - "Single-script mode skips the continue-or-abort prompt — caller already knows what to fix"

patterns-established:
  - "SSH user detection: probe both users with BatchMode=yes, set SSH_USER + SUDO_PREFIX accordingly"
  - "Remote staging: copy all scripts to /tmp/openclaw-setup/ then exec in sorted order — avoids per-script SCP overhead"

requirements-completed: [VM-05, VM-06]

# Metrics
duration: 2min
completed: 2026-03-08
---

# Phase 7 Plan 03: Script Runner and README Summary

**SSH orchestrator (run-scripts.sh) with root/openclaw fallback that copies scripts/ via SCP and executes them in numbered order, plus complete template README documentation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-08T02:02:23Z
- **Completed:** 2026-03-08T02:03:58Z
- **Tasks:** 2
- **Files created:** 2

## Accomplishments

- Created `run-scripts.sh` that auto-detects SSH user: tries root first, falls back to openclaw with `sudo` prefix when root login is disabled (common on Debian 13 cloud images)
- Bulk-copies all scripts to `/tmp/openclaw-setup/` via SCP then executes in sorted order, with per-script pass/fail reporting and continue-or-abort on failure
- Supports single-script re-run mode: `./run-scripts.sh <VM_IP> 05-vnc-setup.sh` for targeted fixes without re-running everything
- Created `README.md` covering the complete two-phase workflow, file structure, access methods, default credentials, and troubleshooting

## Task Commits

Each task was committed atomically:

1. **Task 1: Create run-scripts.sh with root/openclaw SSH fallback** - `bc65382` (feat)
2. **Task 2: Create README.md template documentation** - `1803955` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified

- `infra/vm/templates/openclaw-desktop/run-scripts.sh` — SSH orchestrator; tries root, falls back to openclaw+sudo; bulk SCP then numbered exec; single-script mode; cleanup on exit
- `infra/vm/templates/openclaw-desktop/README.md` — Complete usage guide: Quick Start, What Gets Installed table, File Structure tree, Access Methods, Default Credentials, Troubleshooting, Resource Recommendations

## Decisions Made

- `SCP_CMD` strips `-o BatchMode=yes` via bash string substitution because `BatchMode=yes` is an SSH-specific option not accepted by scp's argument parser
- Cleanup (`rm -rf /tmp/openclaw-setup`) uses `|| true` — non-critical if VM reboots between runs or cleanup is interrupted
- Single-script mode skips the interactive continue-or-abort prompt: when re-running one specific script, the operator already knows what they're fixing
- README follows the practical "how to use" style of `infra/lxc/templates/web3-dev/README.md` — no internals, just operator-facing workflow

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Template is fully complete end-to-end: `create-vm.sh` → cloud-init → `run-scripts.sh` → working OpenClaw desktop VM
- All 3 plans in Phase 07 are complete
- Phase 07 (VM to Run OpenClaw) is fully done

---
*Phase: 07-vm-to-run-openclaw*
*Completed: 2026-03-08*

## Self-Check: PASSED

- FOUND: infra/vm/templates/openclaw-desktop/run-scripts.sh
- FOUND: infra/vm/templates/openclaw-desktop/README.md
- FOUND: .planning/phases/07-vm-to-run-openclaw/07-03-SUMMARY.md
- FOUND commit: bc65382 (Task 1 — run-scripts.sh)
- FOUND commit: 1803955 (Task 2 — README.md)
