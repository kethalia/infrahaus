---
phase: 12-apps-web-removal
plan: "01"
subsystem: infra
tags: [monorepo, cleanup, fumadocs, next.js, pnpm]

# Dependency graph
requires:
  - phase: 10-content-migration-apps-web-to-dashboard
    provides: All 39 MDX files fully mirrored to apps/dashboard/content/docs/
provides:
  - apps/web removed from monorepo with zero dangling references outside .planning/
  - README.md updated to dashboard-centric structure
  - pnpm-lock.yaml cleaned of apps/web stanza
  - infra/lxc/docs/SETUP.md broken link fixed
affects:
  - Phase 13: infra/ configs consolidated into dashboard templates
  - Phase 14: Infrahaus branding

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - README.md
    - pnpm-lock.yaml
    - infra/lxc/docs/SETUP.md

key-decisions:
  - "apps/web deletion is safe — confirmed via Phase 10 diff -rq (zero differences with apps/dashboard/content/docs/)"
  - "Exit 137 during next build is pre-existing OOM constraint; tsc --noEmit passing is authoritative type check"
  - "Grep sweep confirms zero apps/web references outside .planning/ history"

patterns-established: []

requirements-completed:
  - REQ-2.04

# Metrics
duration: 3min
completed: 2026-03-08
---

# Phase 12 Plan 01: Remove apps/web, update workspace + CI + README Summary

**apps/web deleted from monorepo, pnpm lockfile cleaned, README rewritten to dashboard-centric structure, and all dangling references to apps/web eliminated across source/config/markdown files**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-08T18:32:36Z
- **Completed:** 2026-03-08T18:35:54Z
- **Tasks:** 6
- **Files modified:** 3 (plus 56 deleted)

## Accomplishments

- Deleted all 56 files in apps/web/ — content was already fully mirrored to apps/dashboard/content/docs/ in Phase 10
- Regenerated pnpm-lock.yaml with apps/web stanza purged (347 lines removed)
- Rewrote README.md from Fumadocs docs-site framing to dashboard-centric: monorepo structure, Quick Start (port 3002, `pnpm --filter dashboard dev`), updated tech stack entry
- Fixed broken relative link in infra/lxc/docs/SETUP.md (line 373): apps/web → apps/dashboard path
- Grep sweep confirmed zero apps/web references outside .planning/ history files
- Dashboard build verification: tsc --noEmit passes cleanly; exit 137 OOM kill during next build is pre-existing constraint

## Task Commits

Each task was committed atomically:

1. **Task 12-01-01: Delete apps/web directory** - `9279c1d` (chore)
2. **Task 12-01-02: Regenerate pnpm-lock.yaml** - `5e57c1b` (chore)
3. **Task 12-01-03: Rewrite README.md** - `295d7d1` (docs)
4. **Task 12-01-04: Fix broken SETUP.md link** - `1e13ae6` (fix)
5. **Task 12-01-05: Grep sweep** — no file changes (verification only)
6. **Task 12-01-06: Verify dashboard build** — no file changes (verification only)

**Plan metadata:** (docs commit pending)

## Files Created/Modified

- `apps/web/` — 56 files deleted (entire directory removed)
- `pnpm-lock.yaml` — apps/web stanza removed (347 lines)
- `README.md` — rewritten to dashboard-centric (7 lines changed)
- `infra/lxc/docs/SETUP.md` — line 373: apps/web → apps/dashboard link

## Decisions Made

- apps/web deletion is safe — Phase 10 confirmed zero differences between apps/web/content/docs/ and apps/dashboard/content/docs/ via diff -rq
- Exit 137 (OOM kill) during `next build` is pre-existing from Phase 09; tsc --noEmit passing is the authoritative type check per STATE.md
- Grep sweep confirmed all remaining apps/web mentions are exclusively in .planning/ history files (expected)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — all six tasks completed as specified. The exit 137 OOM kill during `next build` is a pre-existing documented constraint, not an issue introduced by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 12 Plan 01 complete — apps/web fully removed from monorepo
- No remaining plans in Phase 12 (single-plan phase)
- Phase 12 complete; ready for Phase 13 (infra/ configs consolidated into dashboard templates)

---
*Phase: 12-apps-web-removal*
*Completed: 2026-03-08*
