---
phase: 09-docs-integration-fumadocs-in-dashboard
plan: "09-01"
subsystem: docs
tags: [fumadocs, mdx, nextjs, docs-route, source-config]

# Dependency graph
requires:
  - phase: 08-lxc-template-engine
    provides: apps/dashboard Next.js project foundation this plan builds on
provides:
  - Fumadocs packages installed in apps/dashboard (fumadocs-core, fumadocs-ui, fumadocs-mdx)
  - /docs route group at src/app/(docs)/docs/[[...slug]]/ rendering DocsPage
  - source.config.ts defining docs collection from content/docs/
  - src/lib/source.ts exporting Fumadocs loader
  - mdx-components.tsx at project root
  - content/docs/index.mdx placeholder content
  - E2E stub tests at e2e/docs.spec.ts
affects: [09-02, 09-03, phase-10]

# Tech tracking
tech-stack:
  added: [fumadocs-core@15.8.5, fumadocs-ui@15.8.5, fumadocs-mdx@14.2.6, "@types/mdx@^2.0.13"]
  patterns:
    - Route group (docs) keeps docs outside dashboard shell layout
    - fumadocs-mdx:collections/* path alias → ./.source/* for generated types
    - RootProvider in (docs)/layout.tsx, DocsLayout in (docs)/docs/layout.tsx

key-files:
  created:
    - apps/dashboard/e2e/docs.spec.ts
    - apps/dashboard/source.config.ts
    - apps/dashboard/content/docs/index.mdx
    - apps/dashboard/src/lib/source.ts
    - apps/dashboard/mdx-components.tsx
    - apps/dashboard/src/app/(docs)/layout.tsx
    - apps/dashboard/src/app/(docs)/docs/layout.tsx
    - apps/dashboard/src/app/(docs)/docs/[[...slug]]/page.tsx
  modified:
    - apps/dashboard/package.json
    - apps/dashboard/next.config.ts
    - apps/dashboard/tsconfig.json
    - pnpm-lock.yaml

key-decisions:
  - "Used ./.source/* (with leading ./) instead of .source/* in tsconfig paths — TypeScript requires relative paths when baseUrl is not set"
  - "Added minimal (docs)/layout.tsx with RootProvider and (docs)/docs/layout.tsx with DocsLayout as blocking requirement — DocsPage requires SidebarContext from DocsLayout to render"
  - "Build verification used NEXT_SKIP_TYPE_CHECK=1 — TypeScript type check step (not compilation) is killed by OOM in this environment, which is a pre-existing constraint; tsc --noEmit passes cleanly"

patterns-established:
  - "Fumadocs route group pattern: (docs)/layout.tsx → RootProvider, (docs)/docs/layout.tsx → DocsLayout, (docs)/docs/[[...slug]]/page.tsx → DocsPage"
  - "fumadocs-mdx:collections/* alias must use ./.source/* with leading ./ in tsconfig"

requirements-completed: [REQ-2.01]

# Metrics
duration: 45min
completed: 2026-03-08
---

# Phase 09 Plan 01: Install Fumadocs + Configure source.config.ts + /docs Route Group Summary

**Fumadocs packages installed in apps/dashboard with /docs catch-all route, source config, MDX components, and DocsLayout wired up for static generation**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-08T15:40:00Z
- **Completed:** 2026-03-08T16:25:00Z
- **Tasks:** 9 (+ 2 deviation fixes)
- **Files modified:** 11

## Accomplishments
- All three Fumadocs packages (fumadocs-core, fumadocs-ui, fumadocs-mdx) installed at ~15.8.5/~14.2.6
- `/docs` route group fully wired: source.config.ts → source.ts → DocsPage renders /docs successfully
- Build compiles successfully and generates `/docs/[[...slug]]` as SSG page
- Wave 0 E2E stubs in place for CI and manual verification

## Task Commits

Each task was committed atomically:

1. **Task 09-01-00: Wave 0 E2E stub** - `bfaeaf9` (test)
2. **Task 09-01-01: Install Fumadocs packages** - `4d58419` (chore)
3. **Task 09-01-02: Create source.config.ts** - `2ad36b5` (feat)
4. **Task 09-01-03: Create content/docs/index.mdx** - `c5559c5` (feat)
5. **Task 09-01-04: Wrap next.config.ts with createMDX()** - `fa2fa07` (feat)
6. **Task 09-01-05: Update tsconfig.json** - `30253b1` (feat)
7. **Task 09-01-06: Create src/lib/source.ts** - `fc87486` (feat)
8. **Task 09-01-07: Create mdx-components.tsx** - `d8191bb` (feat)
9. **Task 09-01-08: Create docs catch-all page.tsx** - `163027a` (feat)
10. **Deviation fix: tsconfig path** - `2a9c0df` (fix)
11. **Deviation fix: minimal layout files** - `db1f7a5` (feat)

## Files Created/Modified
- `apps/dashboard/e2e/docs.spec.ts` - Wave 0 Playwright stubs for /docs unauthenticated redirect tests
- `apps/dashboard/source.config.ts` - Fumadocs docs collection config pointing to content/docs/
- `apps/dashboard/content/docs/index.mdx` - Placeholder root docs page
- `apps/dashboard/next.config.ts` - Wrapped with createMDX() preserving turbopack.root
- `apps/dashboard/tsconfig.json` - Added fumadocs-mdx:collections/* alias and **/*.mdx includes
- `apps/dashboard/src/lib/source.ts` - Fumadocs loader bridge with baseUrl: "/docs"
- `apps/dashboard/mdx-components.tsx` - getMDXComponents() re-exporting fumadocs-ui defaults
- `apps/dashboard/src/app/(docs)/layout.tsx` - RootProvider wrapper for docs route group
- `apps/dashboard/src/app/(docs)/docs/layout.tsx` - DocsLayout with nav and page tree
- `apps/dashboard/src/app/(docs)/docs/[[...slug]]/page.tsx` - DocsPage renderer with SSG
- `apps/dashboard/package.json` - Added fumadocs deps
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Used `./.source/*` (with leading `./`) in tsconfig paths — TypeScript requires relative paths when `baseUrl` is not set
- Added minimal layout files to both `(docs)/` and `(docs)/docs/` levels; `DocsPage` requires `SidebarContext` from `DocsLayout` — without these the build would fail at static generation
- Build verification used `NEXT_SKIP_TYPE_CHECK=1` — the TypeScript type check worker (separate from compilation) is killed by OOM in this environment, which is a pre-existing constraint confirmed by testing against the original codebase. `npx tsc --noEmit` passes cleanly, and compilation succeeds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tsconfig path alias required leading `./`**
- **Found during:** Task 09-01-09 (build verification)
- **Issue:** `"fumadocs-mdx:collections/*": [".source/*"]` — TypeScript reports "Non-relative path not allowed when baseUrl is not set". Build warning appeared before compilation failed.
- **Fix:** Changed to `"./.source/*"` (added leading `./`)
- **Files modified:** `apps/dashboard/tsconfig.json`
- **Verification:** Warning gone from build output; tsc --noEmit passes
- **Committed in:** `2a9c0df` (separate fix commit)

**2. [Rule 3 - Blocking] DocsPage requires SidebarContext — layout files needed**
- **Found during:** Task 09-01-09 (build verification — prerender of /docs)
- **Issue:** `Error: Provider of SidebarContext is required but missing` — DocsPage can't render without being wrapped in DocsLayout
- **Fix:** Added `(docs)/layout.tsx` (RootProvider) and `(docs)/docs/layout.tsx` (DocsLayout) — minimal layout wrappers needed for the route group to render correctly
- **Files modified:** `apps/dashboard/src/app/(docs)/layout.tsx`, `apps/dashboard/src/app/(docs)/docs/layout.tsx`
- **Verification:** /docs renders as SSG page in build output; no prerender errors
- **Committed in:** `db1f7a5` (separate feat commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were necessary for the build to pass. The layout files are scaffolding for plan 09-02 (which adds full layout theming and sidebar integration) — they were added minimally here to unblock the build.

## Issues Encountered
- pnpm store ownership conflict: `/root/.local/share/pnpm` is owned by root, process runs as `clawd-dev`. Resolved by redirecting pnpm store to `/home/clawd-dev/.local/share/pnpm/store/v10`, manually editing package.json, and running `CI=true pnpm install --no-frozen-lockfile`. The packages were already cached from apps/web so download was minimal.
- Next.js TypeScript check step killed by OOM during build (exit 137). Pre-existing issue — confirmed by testing against original codebase. Build compiles and generates static pages successfully with `NEXT_SKIP_TYPE_CHECK=1`. `npx tsc --noEmit` passes cleanly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Fumadocs infrastructure is in place: packages, source config, route group, layout, page rendering
- Plan 09-02 can now add full DocsLayout theming, sidebar customization, search integration, and theme matching the dashboard
- The minimal layout files created here will be expanded in 09-02

---
*Phase: 09-docs-integration-fumadocs-in-dashboard*
*Completed: 2026-03-08*
