---
phase: 08-lxc-container-template-engine
plan: "06"
subsystem: infra
tags: [bash, semgrep, trivy, gitleaks, slither, aderyn, echidna, mythril, solhint, zap, security, lxc]

# Dependency graph
requires:
  - phase: 08-05-lxc-container-template-engine
    provides: "forge-shield scripts directory and Python/Node/Rust toolchains (11_python.sh, 10_node.sh, 13_rust.sh)"
provides:
  - "40_security-web.sh: Semgrep (pipx), Trivy (binary from GitHub releases), Gitleaks (binary from GitHub releases)"
  - "41_security-solidity.sh: Slither (pipx), Aderyn (official installer), Echidna (binary), Mythril (pipx with soft fallback), Solhint (npm)"
  - "42_zap.sh: OWASP ZAP weekly release installed to /opt/zaproxy with /usr/local/bin/zap symlink"
affects:
  - 08-07-lxc-container-template-engine
  - forge-shield template deployment

# Tech tracking
tech-stack:
  added:
    - Semgrep (multi-language static analysis)
    - Trivy (container/filesystem vulnerability scanner)
    - Gitleaks (secret detection)
    - Slither (Solidity static analyzer)
    - Aderyn (Rust-based Solidity analyzer)
    - Echidna (smart contract fuzzer)
    - Mythril (symbolic execution — soft-install with fallback)
    - Solhint (Solidity linter)
    - OWASP ZAP (web application scanner)
  patterns:
    - "Soft-install pattern: Mythril timeout+fallback with warning, does not abort script"
    - "GitHub API release detection: curl + grep -oP for latest tag_name"
    - "Binary installation: wget to /tmp, extract to /usr/local/bin, chmod +x, rm temp"
    - "User-scope installs: su - $USERNAME -c 'pipx/npm install ...' for non-root tools"
    - "System-scope installs: wget binary to /usr/local/bin for system-wide tools"
    - "Idempotent guard: command -v / directory check before each tool installation"

key-files:
  created:
    - templates/forge-shield/scripts/40_security-web.sh
    - templates/forge-shield/scripts/41_security-solidity.sh
    - templates/forge-shield/scripts/42_zap.sh
  modified: []

key-decisions:
  - "Mythril soft-install: timeout 600s + || true pattern so z3 compilation failure does not abort 41_security-solidity.sh"
  - "Echidna installs unzip if absent (apt-get install -y unzip) as Rule 2 auto-fix for correctness"
  - "ZAP URL resolved dynamically from GitHub API releases endpoint (not hardcoded weekly tag)"
  - "nmap/nikto are expected from apt packages in template.yaml — script only verifies, does not install"
  - "ZAP guard is directory-based: [[ -d /opt/zaproxy ]] — symlink re-created on re-run if missing"

patterns-established:
  - "Soft-install pattern: Use timeout + || true for tools with known compilation risk (Mythril/z3)"
  - "Dynamic release detection: curl GitHub API + grep -oP for tag_name to avoid hardcoded versions"

requirements-completed: []

# Metrics
duration: 15min
completed: 2026-03-08
---

# Phase 08 Plan 06: Security Tool Scripts Summary

**Bash installation scripts for web security (Semgrep, Trivy, Gitleaks) and Solidity security (Slither, Aderyn, Echidna, Mythril with soft fallback, Solhint) plus OWASP ZAP headless deployment**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-08T03:23:50Z
- **Completed:** 2026-03-08T03:38:00Z
- **Tasks:** 1
- **Files modified:** 3 created

## Accomplishments

- Created `40_security-web.sh` installing Semgrep via pipx, Trivy binary, Gitleaks binary from GitHub releases with dynamic version detection
- Created `41_security-solidity.sh` installing Slither (pipx), Aderyn (official installer), Echidna (binary), Mythril (pipx with 600s timeout and soft fallback), Solhint (npm)
- Created `42_zap.sh` installing OWASP ZAP weekly release to `/opt/zaproxy` with `/usr/local/bin/zap` symlink, using dynamic GitHub API URL resolution
- All three scripts: idempotent guard checks, `set -euo pipefail`, executable, run as root with user-scoped installs via `su - $USERNAME -c`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create security tool installation scripts** - `f8c351e` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `templates/forge-shield/scripts/40_security-web.sh` - Web/general security tools: Semgrep, Trivy, Gitleaks; verifies nmap/nikto from apt
- `templates/forge-shield/scripts/41_security-solidity.sh` - Solidity security tools: Slither, Aderyn, Echidna, Mythril (soft), Solhint
- `templates/forge-shield/scripts/42_zap.sh` - OWASP ZAP weekly release installer to /opt/zaproxy with symlink

## Decisions Made

- **Mythril soft-install:** `timeout 600 ... || true` pattern ensures z3 compilation failure does not abort the script. Logs a clear warning with manual install instructions.
- **ZAP URL dynamic resolution:** Resolved from GitHub API at install time rather than hardcoded weekly tag, ensuring latest weekly release is always downloaded.
- **nmap/nikto verification only:** Both tools are expected to be installed via `apt` in `template.yaml`. Script verifies they are present and logs warnings if missing — does not install them.
- **Echidna unzip dependency:** `apt-get install -y unzip` added before Echidna extraction since unzip may not be in the base Ubuntu 24.04 LXC image.
- **ZAP guard is directory-based:** `[[ -d /opt/zaproxy ]]` check; symlink is recreated on re-run if accidentally deleted while `/opt/zaproxy` still exists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added unzip installation before Echidna extraction**
- **Found during:** Task 1 (41_security-solidity.sh)
- **Issue:** Echidna ships as a `.zip` archive requiring `unzip`, which may not be present in the minimal Ubuntu 24.04 LXC base image
- **Fix:** Added `command -v unzip || apt-get install -y unzip` guard before extraction
- **Files modified:** `templates/forge-shield/scripts/41_security-solidity.sh`
- **Verification:** Script passes `bash -n` syntax check; guard is idempotent
- **Committed in:** `f8c351e` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing critical dependency)
**Impact on plan:** Auto-fix prevents Echidna installation failure on minimal LXC containers. No scope creep.

## Issues Encountered

- Working directory `/root/projects/infrahaus` is root-owned and not writable by the `dev` user. Used the writable clone at `/tmp/infrahaus-clone` for all file creation and commits. This is the expected working pattern in this environment.

## Self-Check: PASSED

- FOUND: `templates/forge-shield/scripts/40_security-web.sh`
- FOUND: `templates/forge-shield/scripts/41_security-solidity.sh`
- FOUND: `templates/forge-shield/scripts/42_zap.sh`
- FOUND commit: `f8c351e` (feat(08-06))

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All security tool scripts created and committed. Ready for plan 07 (service/file deployment scripts or remaining forge-shield scripts).
- Mythril may fail during actual LXC deployment if Python 3.12+ is the container runtime — this is expected and documented with soft fallback.

---
*Phase: 08-lxc-container-template-engine*
*Completed: 2026-03-08*
