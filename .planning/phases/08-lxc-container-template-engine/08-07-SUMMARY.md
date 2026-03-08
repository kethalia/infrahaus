---
phase: 08-lxc-container-template-engine
plan: 07
subsystem: infra
tags: [lxc, proxmox, security, solidity, foundry, semgrep, trivy, gitleaks, slither, zap, tmux, claude-commands]

requires:
  - phase: 08-lxc-container-template-engine
    provides: forge-shield template structure (template.yaml, scripts directory) created in prior plans

provides:
  - forge-shield files/ directory with USER placeholder artifacts (Claude slash commands, security scripts, CLAUDE.md, tmux.conf)
  - /security-gate Claude slash command for multi-tool security scanning
  - /audit-solidity Claude slash command for Solidity smart contract auditing
  - security-gate.sh CLI script (Gitleaks, Semgrep, Trivy, Slither) with JSON reports
  - zap-scan.sh OWASP ZAP baseline scan wrapper
  - CLAUDE.md documenting all tools, paths, and security workflow for Claude Code context
  - forge-shield pre-deploy.sh validating Proxmox host prerequisites before container creation
  - forge-shield post-deploy.sh printing connection instructions and quick start guide
  - minimal/ template proving engine reusability by directory convention

affects:
  - 08-lxc-container-template-engine (engine deploy.sh must push these files with USER substitution)
  - future template creation (minimal/ serves as copy-paste starting point)

tech-stack:
  added: []
  patterns:
    - "USER placeholder pattern: paths containing USER/ get username substituted by deploy engine"
    - "Hooks lifecycle: pre-deploy runs on Proxmox host (before container exists), post-deploy inside container"
    - "New template by convention: create directory with template.yaml + scripts/ + files/ to add a new template"
    - "Claude slash commands as markdown files in .claude/commands/ (read by Claude Code)"

key-files:
  created:
    - templates/forge-shield/files/home/USER/.claude/commands/security-gate.md
    - templates/forge-shield/files/home/USER/.claude/commands/audit-solidity.md
    - templates/forge-shield/files/home/USER/.local/bin/security-gate.sh
    - templates/forge-shield/files/home/USER/.local/bin/zap-scan.sh
    - templates/forge-shield/files/home/USER/CLAUDE.md
    - templates/forge-shield/files/home/USER/.tmux.conf
    - templates/forge-shield/hooks/pre-deploy.sh
    - templates/forge-shield/hooks/post-deploy.sh
    - templates/minimal/template.yaml
    - templates/minimal/scripts/00_base.sh
    - templates/minimal/scripts/99_verify.sh
    - templates/minimal/files/.gitkeep
  modified: []

key-decisions:
  - "Removed Unicode box-drawing characters from post-deploy.sh summary box to avoid encoding issues in shell output — used ASCII +/-/| instead"
  - "pre-deploy.sh validates CTID and STORAGE env vars with : syntax for fail-fast behavior"
  - "security-gate.sh uses ((PASSED++)) arithmetic for counters (requires bash, not sh)"
  - "minimal/files/.gitkeep preserves files/ directory in git while keeping it empty (demonstrates the convention)"

patterns-established:
  - "Hook naming: pre-deploy.sh runs on host, post-deploy.sh runs inside container"
  - "Script logging prefix: [script-name] prefix on all echo output for grep-friendly logs"
  - "Shell scripts use set -euo pipefail for fail-fast safety"
  - "New templates created by copying minimal/ and customizing template.yaml + scripts/"

requirements-completed: []

duration: 15min
completed: 2026-03-08
---

# Phase 08 Plan 07: forge-shield Files, Hooks, and Minimal Template Summary

**Security-focused forge-shield container files (Claude slash commands, security-gate.sh, zap-scan.sh, CLAUDE.md) plus lifecycle hooks and minimal/ template proving engine reusability**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-08T03:23:43Z
- **Completed:** 2026-03-08T03:30:00Z
- **Tasks:** 2
- **Files modified:** 12 created

## Accomplishments

- Created 6 files in forge-shield/files/home/USER/ — Claude commands, security scripts, CLAUDE.md, .tmux.conf — all with USER placeholder paths for engine substitution
- Created pre-deploy.sh validating Proxmox host prerequisites (OS template, storage, VMID, disk space) before container creation
- Created post-deploy.sh printing ASCII connection guide and quick-start workflow
- Created minimal/ template as a complete, deployable example proving any directory following the convention works with the engine

## Task Commits

1. **Task 1: Create forge-shield files/ directory** - `42d5a6f` (feat)
2. **Task 2: Create hooks and minimal template** - `67b5782` (feat)

## Files Created/Modified

- `templates/forge-shield/files/home/USER/.claude/commands/security-gate.md` - Claude /security-gate slash command (28 lines)
- `templates/forge-shield/files/home/USER/.claude/commands/audit-solidity.md` - Claude /audit-solidity slash command (39 lines)
- `templates/forge-shield/files/home/USER/.local/bin/security-gate.sh` - Security gate CLI (74 lines, executable)
- `templates/forge-shield/files/home/USER/.local/bin/zap-scan.sh` - ZAP scan wrapper (32 lines, executable)
- `templates/forge-shield/files/home/USER/CLAUDE.md` - Environment documentation (108 lines)
- `templates/forge-shield/files/home/USER/.tmux.conf` - Ergonomic tmux config with Ctrl-a prefix
- `templates/forge-shield/hooks/pre-deploy.sh` - Host validation hook (44 lines, executable)
- `templates/forge-shield/hooks/post-deploy.sh` - Connection guide hook (30 lines, executable)
- `templates/minimal/template.yaml` - Minimal template config (42 lines)
- `templates/minimal/scripts/00_base.sh` - Locale + apt-get update (20 lines, executable)
- `templates/minimal/scripts/99_verify.sh` - curl/git/vim check (28 lines, executable)
- `templates/minimal/files/.gitkeep` - Preserves files/ directory convention

## Decisions Made

- Removed Unicode box-drawing characters from post-deploy.sh summary box to avoid encoding issues in various terminal environments — used ASCII `+/-/|` delimiters instead
- pre-deploy.sh uses `${VAR:?message}` bash syntax for fail-fast on missing required env vars (CTID, STORAGE)
- security-gate.sh uses `((PASSED++))` bash arithmetic (requires bash, documented in shebang)
- minimal/files/.gitkeep preserves the files/ directory in git history while keeping it empty — demonstrates the engine convention to template authors

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `/root/projects/infrahaus` is a read-only filesystem mount (dev user, uid=1000, cannot write to root-owned directory). All file creation and git operations were performed in `/tmp/infrahaus` (writable clone with proper dev user permissions). This is the standard working pattern for this environment.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- forge-shield template is now complete: template.yaml (prior plans), scripts (prior plans), files/ (this plan), hooks (this plan)
- minimal/ template is deployable as-is by the engine
- The engine (deploy.sh from plan 08-03/08-04) can now be tested end-to-end with both templates
- Plan 08-08 can proceed with engine integration testing

---
*Phase: 08-lxc-container-template-engine*
*Completed: 2026-03-08*
