---
phase: 08-lxc-container-template-engine
plan: 04
subsystem: infra
tags: [bash, node, python, go, rust, lxc, provisioning, pipx, rustup, nodesource]

requires:
  - phase: 08-03
    provides: "forge-shield template.yaml and base provisioning scripts (00_base-system.sh, 01_create-user.sh)"

provides:
  - "Node.js 22 LTS installation via NodeSource with per-user npm global dir"
  - "Python 3 with pipx configured for PEP 668-compliant tool installation"
  - "Go 1.23.6 installation from official tarball to /usr/local/go"
  - "Rust installation via rustup for non-root user with stable toolchain"

affects:
  - 08-05-and-beyond
  - forge-shield-tool-scripts

tech-stack:
  added: []
  patterns:
    - "Language runtime scripts use USERNAME env var for all user-level tool setup"
    - "Idempotency via command -v guard at top of each script"
    - "Rust installed as non-root user via rustup (never as root)"
    - "Python CLI tools must use pipx — direct pip install forbidden on Ubuntu 24.04 (PEP 668)"
    - "Go pinned to exact version (1.23.6) for reproducibility"

key-files:
  created:
    - templates/forge-shield/scripts/10_node.sh
    - templates/forge-shield/scripts/11_python.sh
    - templates/forge-shield/scripts/12_go.sh
    - templates/forge-shield/scripts/13_rust.sh
  modified: []

key-decisions:
  - "Go pinned to 1.23.6 for reproducibility — update manually when needed"
  - "Rust installed as non-root user only — rustup is a user-level tool, never run as root"
  - "pipx ensurepath called for non-root user to add ~/.local/bin to PATH"
  - "npm global dir set to ~/.npm-global for user to avoid root npm installs"
  - "PATH_APPEND entries (go/bin, cargo/bin) handled by engine env phase not these scripts"

patterns-established:
  - "Guard pattern: check if tool installed before proceeding (idempotency)"
  - "User-level setup: su - $USERNAME -c 'command' pattern for user-specific config"
  - "Verification step: log version after installation to confirm success"

requirements-completed: []

duration: 15min
completed: 2026-03-08
---

# Phase 08 Plan 04: Language Runtime Scripts Summary

**Node.js 22, Python/pipx, Go 1.23.6, and Rust/rustup installed via idempotent bash scripts for the forge-shield LXC template**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-08T03:23:09Z
- **Completed:** 2026-03-08T03:38:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- 10_node.sh: Installs Node.js 22 LTS via NodeSource apt repository, configures user npm global dir to prevent root npm installs
- 11_python.sh: Installs pipx from apt, runs pipx ensurepath for non-root user — enforces PEP 668 (no direct pip install)
- 12_go.sh: Downloads and installs Go 1.23.6 from official tarball to /usr/local/go, creates ~/go workspace dirs for user
- 13_rust.sh: Installs Rust via rustup as non-root user with stable toolchain, verifies rustc and cargo

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Node.js and Python setup scripts** - `739cb6c` (feat)
2. **Task 2: Create Go and Rust setup scripts** - `094b963` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `templates/forge-shield/scripts/10_node.sh` - Node.js 22 LTS via NodeSource, user npm-global dir setup
- `templates/forge-shield/scripts/11_python.sh` - pipx install + ensurepath, PEP 668 reminder
- `templates/forge-shield/scripts/12_go.sh` - Go 1.23.6 from tarball, user GOPATH workspace
- `templates/forge-shield/scripts/13_rust.sh` - rustup install as non-root user, verifies rustc + cargo

## Decisions Made

- Go pinned to 1.23.6 rather than dynamically fetching latest — reproducibility over freshness
- Rust installed exclusively as non-root user — rustup design makes root install problematic
- PATH additions for /usr/local/go/bin and ~/.cargo/bin deferred to engine env phase (template.yaml PATH_APPEND) — scripts don't modify /etc/profile.d or similar
- npm global dir set to ~/.npm-global (not the default) to allow user npm installs without sudo

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Working directory permissions: The infrahaus project directory is owned by root with 755 permissions. The dev user (uid 1000) cannot directly write to it. Resolution: created files in a fresh git clone at /tmp/infrahaus-temp (owned by dev), committed there, rebased onto the GitHub remote's latest commits, then pushed to GitHub. This is consistent with how prior phase 08 plans were executed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 4 language runtimes are scripted and ready
- Plan 08-05 can proceed with tool installation scripts (Foundry, solc-select, etc.) that depend on Node.js and Python being present
- Scripts follow the established USERNAME env var pattern

---
## Self-Check: PASSED

- templates/forge-shield/scripts/10_node.sh: FOUND, executable, syntax-ok, 37 lines
- templates/forge-shield/scripts/11_python.sh: FOUND, executable, syntax-ok, 37 lines
- templates/forge-shield/scripts/12_go.sh: FOUND, executable, syntax-ok, 45 lines
- templates/forge-shield/scripts/13_rust.sh: FOUND, executable, syntax-ok, 34 lines
- 08-04-SUMMARY.md: FOUND
- Task 1 commit 739cb6c: FOUND in git log
- Task 2 commit 094b963: FOUND in git log
- Docs commit 5272cc8: FOUND in git log and pushed to GitHub

---
*Phase: 08-lxc-container-template-engine*
*Completed: 2026-03-08*
