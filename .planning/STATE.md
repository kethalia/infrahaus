---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: — LXC Template Manager Dashboard
status: planning
last_updated: "2026-03-08T18:38:29.120Z"
last_activity: "2026-03-08 — Completed 12-01: apps/web deleted, pnpm lockfile cleaned, README rewritten, SETUP.md link fixed"
progress:
  total_phases: 6
  completed_phases: 3
  total_plans: 6
  completed_plans: 6
  percent: 95
---

# Project State

## Current Position

**Project:** Infrahaus (apps/dashboard as hub)
**Milestone:** v2.0 — Dashboard as Hub
**Phase:** 12 — apps/web Removal — COMPLETE ✅
**Plan:** 12-01 COMPLETE
**Status:** Ready to plan
**Last activity:** 2026-03-08 — Completed 12-01: apps/web deleted, pnpm lockfile cleaned, README rewritten, SETUP.md link fixed

Progress: [██████████] 95%

## Milestone v1.0 Summary (CLOSED ✅)

**Tag:** v1.0 | **Branch:** oscar/milestone-1 | **Completed:** 2026-03-08

All 12 phases complete. LXC container management dashboard delivered:
- Next.js 15 + Web3 auth (SIWE + Universal Profiles)
- Template system + container creation wizard
- Multi-node Proxmox support + pool-based access control
- Monitoring (RRD charts, service discovery)
- CI/CD + Docker + VM template + LXC template engine (forge-shield)

See `.planning/milestones/v1.0-ROADMAP.md` for full archive.

## Milestone v2.0 Scope

Make `apps/dashboard` the centrepiece of the entire repo:

1. **Phase 09:** Fumadocs integrated into apps/dashboard (/docs route) ✅ COMPLETE
2. **Phase 10:** All 39 MDX files migrated from apps/web → apps/dashboard ✅ COMPLETE
3. **Phase 11:** New documentation (Proxmox setup, token creation, etc.)
4. **Phase 12:** apps/web removed from monorepo ✅ COMPLETE
5. **Phase 13:** infra/ configs consolidated into dashboard templates
6. **Phase 14:** Infrahaus branding unified throughout

## Decisions from Phase 12 Plan 01

- apps/web deletion confirmed safe — Phase 10 diff -rq showed zero differences with apps/dashboard/content/docs/ before deletion
- Grep sweep confirmed zero apps/web references outside .planning/ history after deletion + README/SETUP.md fixes
- Exit 137 (OOM kill) during next build remains pre-existing; tsc --noEmit is the authoritative build check

## Decisions from Phase 10 Plan 02

- Build OOM kill (exit 137) is pre-existing from Phase 09 — Fumadocs MDX generation completes successfully before OOM; not caused by Phase 10 migration
- Lint failures in `.source/` auto-generated files are pre-existing from Phase 09 — Phase 10 adds only MDX/JSON content, no new lint errors
- All 16 unique /docs/ link targets in migrated MDX resolve to existing files

## Decisions from Phase 10 Plan 01

- `cp -r apps/web/content/docs/. apps/dashboard/content/docs/` with trailing dot copies directory contents directly into destination — avoids nesting `docs/docs/` and lands files correctly

## Decisions from Phase 09 Plan 01

- `fumadocs-mdx:collections/*` tsconfig alias must use `./.source/*` (with leading `./`) — TypeScript requires relative paths when `baseUrl` is not set
- `(docs)` route group needs two layout files: `(docs)/layout.tsx` (RootProvider) and `(docs)/docs/layout.tsx` (DocsLayout) — DocsPage requires SidebarContext
- Build verified via `npx tsc --noEmit` + `NEXT_SKIP_TYPE_CHECK=1 next build` — the TypeScript type-check worker is OOM-killed in this environment (pre-existing constraint)

## Decisions from Phase 09 Plan 03

- isActive pattern for sidebar: `href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")` — root requires exact match to avoid activating on all routes; others use startsWith to support sub-path activation (e.g., /docs/getting-started activates Documentation)
- Documentation nav item placed between Packages and Settings in navItems array

## Decisions from Phase 09 Plan 02

- docs.css must include `@import "tailwindcss"` before fumadocs CSS imports — fumadocs-ui shiki.css uses `@apply top-0` which requires Tailwind v4 processing context (mirrors apps/web pattern)
- RootProvider consolidated into `(docs)/docs/layout.tsx` alongside DocsLayout — `(docs)/layout.tsx` reduced to passthrough
- E2E tests require Playwright browser binaries; not installed in this CI environment (pre-existing)

## Decisions Carried Forward from v1.0

- Always use shadcn/ui components (see apps/dashboard/CLAUDE.md)
- Cookie writes only in Server Actions / Route Handlers (Next.js 16+ requirement)
- Compound container IDs: `{nodeName}/{vmid}` format
- Identity = Universal Profile address (session.address)
- Proxmox auth via API tokens per user

## Blockers/Concerns

- Build environment OOM kills the TypeScript type-check worker during `next build`. Pre-existing, non-blocking — `tsc --noEmit` passes, compilation succeeds.
- Zod v3→v4 incompatibility (pre-existing, non-blocking) — tracked for cleanup
