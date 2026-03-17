---
phase: 08-lxc-container-template-engine
plan: 09
subsystem: infra
tags: [bash, zsh, oh-my-zsh, claude-code, security-skills, shell-configuration, lxc, provisioning]

requires:
  - phase: 08-lxc-container-template-engine (08-01)
    provides: Engine library modules (logging, config, state, container, files, hooks)
  - phase: 08-lxc-container-template-engine (08-03)
    provides: forge-shield template.yaml and base scripts (00_base-system.sh, 01_create-user.sh)
  - phase: 08-lxc-container-template-engine (08-05)
    provides: EVM dev tools and AI/productivity tool scripts (10-32 range)
  - phase: 08-lxc-container-template-engine (08-06)
    provides: Security tool scripts (40-42 range)

provides:
  - 50_claude-skills.sh — creates ~/.claude/commands and ~/.claude/skills dirs, clones community security skills
  - 60_shell-setup.sh — installs oh-my-zsh, configures .zshrc with PATH, aliases, cargo env, forge-shield marker
  - 99_verify.sh — comprehensive tool verification with pass/fail/skip summary for all forge-shield tools

affects:
  - 08-08-plan (integration verification and README — depends on all scripts existing)

tech-stack:
  added: [oh-my-zsh, zsh, claude-code-skills (optional)]
  patterns: [idempotency via marker grep, su-minus for user-login-shell commands, optional-tool skip pattern]

key-files:
  created:
    - templates/forge-shield/scripts/50_claude-skills.sh
    - templates/forge-shield/scripts/60_shell-setup.sh
    - templates/forge-shield/scripts/99_verify.sh
  modified: []

key-decisions:
  - "50_claude-skills.sh: guard checks if commands/ has files (not just existence) to avoid re-running when engine pushes files later"
  - "60_shell-setup.sh: appends to .zshrc rather than replacing to avoid clobbering oh-my-zsh installation"
  - "60_shell-setup.sh: forge-shield marker comment enables idempotency without tracking separate state"
  - "99_verify.sh: exits 1 only for missing critical tools (node, python3, forge, slither etc), not optional ones (myth, opencode, ZAP)"
  - "99_verify.sh: uses su - USERNAME -c for user-installed tools to get login shell PATH"
  - "99_verify.sh: also verifies Claude skill dirs and .zshrc forge-shield marker as part of environment check"

patterns-established:
  - "Marker-based idempotency: grep for a marker string in config files instead of checking file existence"
  - "Soft-fail optional tools: separate OPTIONAL_FAIL counter, never causes exit 1"
  - "User tool checks via su - (login shell): ensures tool PATH reflects actual user environment"

requirements-completed: []

duration: 9min
completed: 2026-03-08
---

# Phase 08 Plan 09: Claude Skills, Shell Setup, and Verification Summary

**Three finalization scripts for forge-shield LXC template: Claude skill directory setup, oh-my-zsh shell configuration, and comprehensive tool verification with pass/fail/skip reporting**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-08T03:23:52Z
- **Completed:** 2026-03-08T03:32:35Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- `50_claude-skills.sh` creates `~/.claude/commands` and `~/.claude/skills` directories with correct ownership, optionally clones community security skills from GitHub anthropics/claude-code-skills repo
- `60_shell-setup.sh` installs oh-my-zsh unattended, appends forge-shield .zshrc config (ZSH_THEME, plugins, PATH for all tool dirs, cargo env source, security aliases), changes default shell to zsh
- `99_verify.sh` checks every tool installed by forge-shield scripts (20 critical + 4 optional), verifies Claude skill dirs and .zshrc marker, prints X/Y summary, exits 1 only if critical tools are missing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Claude skills and shell setup scripts** - `230e331` (feat)
2. **Task 2: Create final verification script** - `f64b69c` (feat)

## Files Created/Modified
- `templates/forge-shield/scripts/50_claude-skills.sh` - Claude skill directory setup with optional community skills clone
- `templates/forge-shield/scripts/60_shell-setup.sh` - Zsh/oh-my-zsh configuration with forge-shield defaults
- `templates/forge-shield/scripts/99_verify.sh` - Final tool verification with pass/fail/skip summary

## Decisions Made
- Guard in `50_claude-skills.sh` checks if `commands/` directory has files (not just exists) — the engine's file push phase adds files there, so "directory exists with files" is the reliable already-configured signal
- `60_shell-setup.sh` appends to `.zshrc` rather than replacing it, to preserve oh-my-zsh's initial setup (which creates .zshrc during installation)
- `99_verify.sh` separates optional tools (myth, opencode, ZAP, oh-my-zsh) from critical ones — exit code 1 only for missing critical tools
- User-installed tools checked via `su - $USERNAME -c "command -v TOOL"` to get login shell with full PATH (avoids pct exec PATH issues documented in RESEARCH.md)

## Deviations from Plan

None - plan executed exactly as written. All three scripts follow the specified structure including idempotency guards, `#!/usr/bin/env bash`, `set -euo pipefail`, log prefix convention, and `su - $USERNAME -c` for user-context operations.

## Issues Encountered
- Repo at `/root/projects/infrahaus/` is root-owned, dev user (uid 1000) cannot write directly. Resolved by working in `/tmp/infrahaus/` (dev-owned clone) and pushing to origin — established pattern from phase 07.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 3 scripts pass `bash -n` syntax check
- forge-shield template now has all provisioning scripts: base (00-01), languages (10-13 range), EVM dev (20-21), AI/prod (30-32), security (40-42), skills/shell (50-60), verification (99)
- Plan 08-08 (integration verification + README) can proceed — all scripts exist for `bash -n` validation

## Self-Check: PASSED

All created files exist and all commits are present in the repository.

| Check | Result |
|-------|--------|
| `templates/forge-shield/scripts/50_claude-skills.sh` | FOUND |
| `templates/forge-shield/scripts/60_shell-setup.sh` | FOUND |
| `templates/forge-shield/scripts/99_verify.sh` | FOUND |
| `.planning/phases/08-lxc-container-template-engine/08-09-SUMMARY.md` | FOUND |
| Commit `230e331` (Task 1) | FOUND |
| Commit `f64b69c` (Task 2) | FOUND |
| Commit `811c066` (Metadata) | FOUND |

---
*Phase: 08-lxc-container-template-engine*
*Completed: 2026-03-08*
