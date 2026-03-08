---
phase: 08-lxc-container-template-engine
plan: 05
subsystem: infra
tags: [bash, foundry, solc-select, claude-code, opencode, gsd, lxc, evm, solidity]

requires:
  - phase: 08-04-language-runtimes
    provides: "Node.js (10_node.sh), Python/pipx (11_python.sh), Go (12_go.sh), Rust (13_rust.sh) — all required by 20/21/30/31 scripts"

provides:
  - "20_foundry.sh: Foundry EVM toolkit installer (forge, cast, anvil, chisel) via foundryup"
  - "21_solc-select.sh: Solidity compiler version manager via pipx with 0.8.28 default"
  - "30_claude-code.sh: Claude Code CLI installer via official curl script"
  - "31_opencode.sh: OpenCode AI assistant installer with go install fallback"
  - "32_gsd-install.sh: GSD workflow installer from GitHub with manual fallback"

affects:
  - 08-06-security-tools
  - 08-07-environment-config
  - 08-09-deploy-integration

tech-stack:
  added:
    - foundryup (Foundry installer bootstrap)
    - solc-select (Solidity compiler version manager via pipx)
    - Claude Code CLI (official curl installer)
    - OpenCode (official curl installer + go install fallback)
    - GSD workflow (git clone + install.sh)
  patterns:
    - "Idempotency guard: command -v check before install"
    - "User-scoped install: all tools installed via su - $USERNAME -c"
    - "Official installer first, fallback method second (OpenCode, GSD)"
    - "Bracketed log prefix: [NN_scriptname] for traceability"

key-files:
  created:
    - templates/forge-shield/scripts/20_foundry.sh
    - templates/forge-shield/scripts/21_solc-select.sh
    - templates/forge-shield/scripts/30_claude-code.sh
    - templates/forge-shield/scripts/31_opencode.sh
    - templates/forge-shield/scripts/32_gsd-install.sh
  modified: []

key-decisions:
  - "Foundry installs to ~/.foundry/bin/ — PATH_APPEND in template.yaml handles PATH (not script responsibility)"
  - "solc-select uses pipx (not pip) — PEP 668 enforced on Ubuntu 24.04"
  - "Default Solidity version pinned to 0.8.28 for reproducibility"
  - "Claude Code authentication post-install is expected — noted in script comment"
  - "OpenCode fallback order: official curl installer first, then go install"
  - "GSD fallback: if repo unavailable (private), creates directory and logs manual install instructions"
  - "All verification uses || patterns to accept either --version or --help output as success"

patterns-established:
  - "Idempotent guard: test -x or command -v before install, exit 0 on skip"
  - "All user tools installed with su - $USERNAME -c (never as root)"
  - "Fallback methods logged clearly with WARNING prefix"
  - "Tool verification accepts lenient output (version OR help text)"

requirements-completed: []

duration: 5min
completed: 2026-03-08
---

# Phase 08 Plan 05: EVM and AI Tool Scripts Summary

**Five idempotent provisioning scripts installing Foundry, solc-select, Claude Code, OpenCode, and GSD workflow for the forge-shield LXC container template**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-08T03:23:13Z
- **Completed:** 2026-03-08T03:28:15Z
- **Tasks:** 2
- **Files modified:** 5 created

## Accomplishments

- Created 20_foundry.sh installing Foundry (forge, cast, anvil, chisel) via foundryup as the non-root user
- Created 21_solc-select.sh installing solc-select via pipx with Solidity 0.8.28 set as default
- Created 30_claude-code.sh installing Claude Code CLI via official installer with auth note
- Created 31_opencode.sh installing OpenCode with curl installer + go install fallback
- Created 32_gsd-install.sh cloning and running GSD installer with graceful fallback if repo unavailable

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EVM development tool scripts** - `b977cca` (feat)
2. **Task 2: Create AI and productivity tool scripts** - `f09780f` (feat)

**Plan metadata:** `docs(08-05)` final commit

## Files Created/Modified

- `templates/forge-shield/scripts/20_foundry.sh` - Foundry EVM toolkit installation for non-root user (42 lines)
- `templates/forge-shield/scripts/21_solc-select.sh` - Solidity compiler version manager via pipx (38 lines)
- `templates/forge-shield/scripts/30_claude-code.sh` - Claude Code CLI installation via official installer (34 lines)
- `templates/forge-shield/scripts/31_opencode.sh` - OpenCode installation with go install fallback (45 lines)
- `templates/forge-shield/scripts/32_gsd-install.sh` - GSD workflow cloning and installation (60 lines)

## Decisions Made

- Foundry binaries land in ~/.foundry/bin/ — PATH configuration is handled by template.yaml PATH_APPEND, not by the install scripts
- solc-select installs via pipx (not pip directly) to comply with Ubuntu 24.04 PEP 668 enforcement — depends on 11_python.sh
- Default Solidity version pinned to 0.8.28 for reproducibility across deployments
- Claude Code authentication is intentionally post-install — users run `claude auth login` on first use
- OpenCode installer is tried first; go install is the fallback (requires 12_go.sh)
- GSD install gracefully handles private/unavailable repo by creating the directory and logging manual steps

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Working directory `/root/projects/infrahaus` is root-owned with no write access for the `dev` user process. Execution used `/tmp/infrahaus` (a writable git clone with same remote) for file creation and commits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 EVM and AI tool scripts ready for integration into deploy.sh execution pipeline
- Scripts numbered 20-32 slot cleanly between language runtimes (10-13) and security tools (40+)
- GSD fallback path documented for when/if repo becomes accessible

## Self-Check: PASSED

- FOUND: templates/forge-shield/scripts/20_foundry.sh (42 lines, executable, syntax pass)
- FOUND: templates/forge-shield/scripts/21_solc-select.sh (38 lines, executable, syntax pass)
- FOUND: templates/forge-shield/scripts/30_claude-code.sh (34 lines, executable, syntax pass)
- FOUND: templates/forge-shield/scripts/31_opencode.sh (45 lines, executable, syntax pass)
- FOUND: templates/forge-shield/scripts/32_gsd-install.sh (60 lines, executable, syntax pass)
- FOUND commit b977cca: feat(08-05): Create EVM development tool scripts for forge-shield
- FOUND commit f09780f: feat(08-05): Create AI and productivity tool scripts for forge-shield
