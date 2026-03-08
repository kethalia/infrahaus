---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Dashboard as Hub
status: active
stopped_at: "Completed 10-01-PLAN.md — 39 MDX/meta.json docs migrated from apps/web to apps/dashboard"
last_updated: "2026-03-08T18:07:12Z"
last_activity: "2026-03-08 — Completed 10-01: Migrate 39 MDX and meta.json docs files from apps/web to apps/dashboard"
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 12
  completed_plans: 4
  percent: 33
---

# Project State

## Current Position

**Project:** Infrahaus (apps/dashboard as hub)
**Milestone:** v2.0 — Dashboard as Hub
**Phase:** 10 — Content Migration (apps/web → apps/dashboard) — Plan 01 COMPLETE
**Plan:** 10-01 COMPLETE
**Status:** In progress (Phase 10 plan 01 done)
**Last activity:** 2026-03-08 — Completed 10-01: 39 MDX/meta.json docs migrated from apps/web to apps/dashboard

Progress: [███░░░░░░░] 33%

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
2. **Phase 10:** All 29 MDX files migrated from apps/web → apps/dashboard ← IN PROGRESS (plan 01 done)
3. **Phase 11:** New documentation (Proxmox setup, token creation, etc.)
4. **Phase 12:** apps/web removed from monorepo
5. **Phase 13:** infra/ configs consolidated into dashboard templates
6. **Phase 14:** Infrahaus branding unified throughout

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
