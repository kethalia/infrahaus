---
phase: 07-vm-to-run-openclaw
plan: "01"
subsystem: infra
tags: [proxmox, vm, debian, cloud-init, qemu, xfce, openclaw]

# Dependency graph
requires: []
provides:
  - infra/vm/templates/openclaw-desktop/ directory structure (VM template pattern)
  - template.conf with desktop resources and VM-specific settings (q35, OVMF, virtio)
  - cloud-init/user-data.yaml minimal bootstrap (openclaw user, SSH, prerequisite packages)
  - create-vm.sh wrapping community ProxmoxVE Debian 13 script with cloud-init injection
affects:
  - 07-02-vm-to-run-openclaw (run-scripts.sh uses VM created here)
  - 07-03-vm-to-run-openclaw (depends on running VM from this plan)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - infra/vm/ mirrors infra/lxc/ directory structure for VM-specific templates
    - template.conf pattern: bash-sourceable metadata with env-var-overridable defaults
    - bash -c subshell for community scripts (whiptail-interactive, cannot be sourced)
    - VMID detection via qm list hostname search (subshell VMID inaccessible)
    - VM stays running after create-vm.sh — never converted to Proxmox template

key-files:
  created:
    - infra/vm/templates/openclaw-desktop/template.conf
    - infra/vm/templates/openclaw-desktop/cloud-init/user-data.yaml
    - infra/vm/templates/openclaw-desktop/create-vm.sh
  modified: []

key-decisions:
  - "VM stays running after creation — do NOT run qm template. A running VM is immediately usable."
  - "bash -c subshell (not source) for community VM scripts — they use whiptail interactive dialogs"
  - "VMID detection via qm list hostname search — VMID inaccessible from subshell"
  - "cloud-init is intentionally minimal — all software installation deferred to run-scripts.sh (Plan 02)"
  - "passwordless sudo (NOPASSWD:ALL) in cloud-init enables run-scripts.sh automation when root SSH is disabled"
  - "chage -d 0 forces openclaw password change on first interactive login"

patterns-established:
  - "VM template pattern: template.conf + cloud-init/ + create-vm.sh mirrors LXC template structure"
  - "cloud-init minimal bootstrap: user creation, SSH, qemu-guest-agent — no application software"
  - "community script env pre-set: export var_cpu, var_ram, DISK_SIZE, HN, START_VM before bash -c"

requirements-completed: [VM-01, VM-02]

# Metrics
duration: 2min
completed: 2026-03-08
---

# Phase 7 Plan 01: VM Template Directory Structure Summary

**ProxmoxVE Debian 13 VM template with cloud-init minimal bootstrap — openclaw user, SSH, and qemu-guest-agent only, with create-vm.sh wrapping the community Debian 13 script**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-08T01:56:08Z
- **Completed:** 2026-03-08T01:58:56Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments

- Established `infra/vm/templates/openclaw-desktop/` directory structure following the same conventions as `infra/lxc/templates/web3-dev/`
- Created `template.conf` with desktop-appropriate resources (4 CPU, 4096 MB RAM, 32G disk) and VM-specific settings (q35 machine, OVMF BIOS, virtio display, host CPU type)
- Created minimal `cloud-init/user-data.yaml` — creates `openclaw` user with passwordless sudo, forces password change on first login, installs only bootstrap packages (no desktop software)
- Created `create-vm.sh` wrapping the community ProxmoxVE Debian 13 script via bash -c subshell, then injecting cloud-init config via `qm set --cicustom`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create template.conf and cloud-init/user-data.yaml** - `9581a4b` (feat)
2. **Task 2: Create create-vm.sh wrapper script** - `b83188f` (feat)

## Files Created/Modified

- `infra/vm/templates/openclaw-desktop/template.conf` — VM metadata and env-var-overridable resource defaults; VM-specific fields (MACHINE, BIOS, DISPLAY, CPU_TYPE, START_VM)
- `infra/vm/templates/openclaw-desktop/cloud-init/user-data.yaml` — Minimal cloud-init bootstrap: openclaw user, passwordless sudo, force-change on first login, prerequisite packages only
- `infra/vm/templates/openclaw-desktop/create-vm.sh` — Entry point wrapping community Debian 13 VM script; detects VMID by hostname; injects cloud-init; VM stays running

## Decisions Made

- **VM stays running** — `create-vm.sh` does NOT call `qm template`. VM is immediately usable. Users can manually call `qm template <VMID>` later if cloning is needed.
- **bash -c subshell** — Community VM scripts use whiptail interactive dialogs and cannot be sourced. Tradeoff: `$VMID` is inaccessible from the subshell, so VMID is detected by hostname after the script completes.
- **Minimal cloud-init** — All desktop software (XFCE, Chrome, Node.js, TigerVNC, OpenClaw) is deferred to `run-scripts.sh` (Plan 02). Cloud-init only bootstraps the user and SSH access.
- **passwordless sudo** — Required so `run-scripts.sh` can execute root-level commands as the `openclaw` user when root SSH login is disabled.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Verification regex `! grep -q 'openclaw'` in cloud-init check also matches the username/hostname (correct content). Comment-only `qm template` references also trigger `grep -q 'qm template'` check. Both are false positives — actual content is correct per plan spec.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- VM template structure is complete and ready for Plan 02 (post-install run scripts)
- `create-vm.sh` guides operator to run `./run-scripts.sh <VM_IP>` after VM boots
- Plans 02 and 03 can build on this foundation

---
*Phase: 07-vm-to-run-openclaw*
*Completed: 2026-03-08*

## Self-Check: PASSED

- FOUND: infra/vm/templates/openclaw-desktop/template.conf
- FOUND: infra/vm/templates/openclaw-desktop/cloud-init/user-data.yaml
- FOUND: infra/vm/templates/openclaw-desktop/create-vm.sh
- FOUND: .planning/phases/07-vm-to-run-openclaw/07-01-SUMMARY.md
- FOUND commit: 9581a4b (Task 1 — template.conf + user-data.yaml)
- FOUND commit: b83188f (Task 2 — create-vm.sh)
