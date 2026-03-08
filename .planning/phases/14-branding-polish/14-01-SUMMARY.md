---
phase: 14-branding-polish
plan: "01"
subsystem: ui
tags: [branding, next.js, metadata, favicon, web3, siwe, pnpm, docker, ci]

requires:
  - phase: 13-infra-template-consolidation
    provides: Fumadocs cross-links and infra catalog — dashboard is hub; branding now unified

provides:
  - Unified "Infrahaus" brand across all dashboard surfaces (metadata, sidebar, login, Web3)
  - Scoped package name @infrahaus/dashboard
  - All --filter references updated monorepo-wide
  - Custom IH monogram SVG favicon served via Next.js metadata file convention

affects: [future phases using pnpm filter, docker builds, CI, playwright E2E tests]

tech-stack:
  added: []
  patterns:
    - "SVG favicon via apps/dashboard/src/app/icon.svg — Next.js App Router metadata file convention auto-serves it"
    - "Scoped package @infrahaus/dashboard — use --filter @infrahaus/dashboard in all tooling references"

key-files:
  created:
    - apps/dashboard/src/app/icon.svg
  modified:
    - apps/dashboard/src/app/layout.tsx
    - apps/dashboard/src/components/app-sidebar.tsx
    - apps/dashboard/src/app/login/page.tsx
    - apps/dashboard/src/lib/web3/config.ts
    - apps/dashboard/src/components/providers/web3-provider.tsx
    - apps/dashboard/package.json
    - Dockerfile
    - docker-compose.yml
    - .github/workflows/ci.yml
    - apps/dashboard/playwright.config.ts
    - README.md
    - apps/dashboard/README.md

key-decisions:
  - "Package renamed to @infrahaus/dashboard (scoped) — all --filter references updated explicitly across Dockerfile, docker-compose.yml, ci.yml, playwright.config.ts, README.md"
  - "SVG favicon created as icon.svg (not replacing favicon.ico) — Next.js metadata file convention serves SVG on modern browsers; ICO remains as legacy fallback"
  - "SIWE statement updated: 'Sign in to Infrahaus with your Universal Profile.' — wallet signing prompt now shows Infrahaus brand"

patterns-established:
  - "All pnpm filter references must use --filter @infrahaus/dashboard (not bare 'dashboard')"

requirements-completed:
  - REQ-2.07

duration: 18min
completed: "2026-03-08"
---

# Phase 14 Plan 01: Rename to Infrahaus — Summary

**All "LXC Manager" / "LXC Template Manager" product name occurrences replaced with "Infrahaus" across dashboard source, config, CI, Docker, and README; package scoped to @infrahaus/dashboard; custom IH monogram SVG favicon added.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-08T19:27:00Z
- **Completed:** 2026-03-08T19:45:00Z
- **Tasks:** 15 (13 edit/create + 2 verify)
- **Files modified:** 13

## Accomplishments

- Replaced all "LXC Manager" and "LXC Template Manager" strings throughout dashboard source, configs, and documentation (zero remaining)
- Renamed package from `dashboard` to `@infrahaus/dashboard` and updated all 10 downstream `--filter dashboard` references in Dockerfile, docker-compose.yml, ci.yml, playwright.config.ts, and root README
- Added custom `icon.svg` favicon with IH monogram on dark background — served automatically by Next.js App Router metadata file convention
- TypeScript type-check (`npx tsc --noEmit`) passes with exit 0

## Task Commits

Each task was committed atomically:

1. **Task 14-01-01: Update dashboard metadata in layout.tsx** — `a6d84ef` (feat)
2. **Task 14-01-02: Update sidebar brand name in app-sidebar.tsx** — `074f148` (feat)
3. **Task 14-01-03: Update login page heading in login/page.tsx** — `5915389` (feat)
4. **Task 14-01-04: Update RainbowKit appName in web3/config.ts** — `3a05571` (feat)
5. **Task 14-01-05: Update SIWE statement in web3-provider.tsx** — `d8d2d6b` (feat)
6. **Task 14-01-06: Rename package to @infrahaus/dashboard in package.json** — `f66d259` (chore)
7. **Task 14-01-07: Update --filter references in Dockerfile** — `6dbceef` (chore)
8. **Task 14-01-08: Update --filter references in docker-compose.yml** — `4baa9b3` (chore)
9. **Task 14-01-09: Update --filter references in CI workflow** — `5ff54c6` (chore)
10. **Task 14-01-10: Update --filter reference in playwright.config.ts** — `e95b2cb` (chore)
11. **Task 14-01-11: Update --filter reference in root README** — `290cbf0` (docs)
12. **Task 14-01-12: Update apps/dashboard README** — `573d2af` (docs)
13. **Task 14-01-13: Replace favicon with Infrahaus branded icon** — `31cf601` (feat)
14. **Task 14-01-14: Verify zero old branding strings remain** — (verify, no commit needed)
15. **Task 14-01-15: TypeScript type-check passes** — (verify, no commit needed)

## Files Created/Modified

- `apps/dashboard/src/app/layout.tsx` — metadata title/description updated to Infrahaus branding with template pattern
- `apps/dashboard/src/components/app-sidebar.tsx` — sidebar header "LXC Manager" → "Infrahaus"
- `apps/dashboard/src/app/login/page.tsx` — CardTitle "LXC Manager" → "Infrahaus"
- `apps/dashboard/src/lib/web3/config.ts` — RainbowKit appName "LXC Manager" → "Infrahaus"
- `apps/dashboard/src/components/providers/web3-provider.tsx` — SIWE statement updated to Infrahaus
- `apps/dashboard/package.json` — name "dashboard" → "@infrahaus/dashboard"
- `Dockerfile` — 2 occurrences of --filter dashboard → --filter @infrahaus/dashboard
- `docker-compose.yml` — 1 occurrence updated
- `.github/workflows/ci.yml` — 6 occurrences updated
- `apps/dashboard/playwright.config.ts` — webServer command updated
- `README.md` — Quick Start dev command updated
- `apps/dashboard/README.md` — heading and description updated to Infrahaus
- `apps/dashboard/src/app/icon.svg` — created: IH monogram SVG favicon

## Decisions Made

- Package renamed to `@infrahaus/dashboard` (scoped) — all --filter references updated explicitly across all tooling files for clarity, even though pnpm partial matching would have still resolved bare `dashboard`
- SVG favicon created as `icon.svg` (not replacing `favicon.ico`) — Next.js App Router metadata file convention auto-serves the SVG on modern browsers; existing ICO remains as legacy browser fallback
- SIWE statement updated to use "Infrahaus" so users see the brand name in their wallet signing prompts

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 14 Plan 01 complete — all Infrahaus branding unified throughout dashboard source, configs, CI, Docker, and documentation
- Zero "LXC Manager" / "LXC Template Manager" strings remain in production code
- Ready for remaining Phase 14 plans (further branding polish tasks)

---
*Phase: 14-branding-polish*
*Completed: 2026-03-08*
