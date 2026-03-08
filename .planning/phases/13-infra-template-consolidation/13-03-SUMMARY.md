---
phase: 13-infra-template-consolidation
plan: "03"
subsystem: docs
tags: [fumadocs, mdx, callout, cross-linking, docs]

# Dependency graph
requires:
  - phase: 13-01
    provides: LXC templates for Dokploy and WireGuard Proxy
  - phase: 13-02
    provides: /infra catalog page at /infra route

provides:
  - "Deploy via Dashboard" callout in dokploy.mdx linking to /templates
  - "Deploy via Dashboard" callout in wireguard.mdx linking to /templates
  - "Dashboard Infra Catalog" callout in ai/index.mdx linking to /infra
  - "Dashboard Infra Catalog" callout in ai/ollama.mdx linking to /infra
  - "Dashboard Infra Catalog" callout in media/jellyfin.mdx linking to /infra
  - "Dashboard Infra Catalog" callout in gaming/index.mdx linking to /infra
  - "Dashboard Infra Catalog" callout in blockchain/lukso-node.mdx linking to /infra

affects: [docs navigation, /infra, /templates, dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fumadocs-ui Callout import at top of MDX file (below frontmatter), callout in body"
    - "LXC-deployable services link to /templates; VM-only services link to /infra"

key-files:
  created: []
  modified:
    - apps/dashboard/content/docs/deployment/dokploy.mdx
    - apps/dashboard/content/docs/networking/wireguard.mdx
    - apps/dashboard/content/docs/ai/index.mdx
    - apps/dashboard/content/docs/ai/ollama.mdx
    - apps/dashboard/content/docs/media/jellyfin.mdx
    - apps/dashboard/content/docs/gaming/index.mdx
    - apps/dashboard/content/docs/blockchain/lukso-node.mdx

key-decisions:
  - "LXC-deployable services (Dokploy, WireGuard) link to /templates; GPU/VM-only services link to /infra"
  - "Callout position: after overview paragraph, before Prerequisites or first ## heading"
  - "Fumadocs-ui Callout import placed immediately after frontmatter closing --- (before ## heading)"

patterns-established:
  - "Callout pattern: import at top of file, <Callout type='info'> in body after overview"

requirements-completed:
  - REQ-2.05

# Metrics
duration: 3min
completed: 2026-03-08
---

# Phase 13 Plan 03: Infra Docs Cross-Linking Summary

**Fumadocs `<Callout>` blocks added to 7 MDX docs pages linking LXC-deployable services to `/templates` and VM-only services to `/infra`**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-08T19:05:08Z
- **Completed:** 2026-03-08T19:08:17Z
- **Tasks:** 8
- **Files modified:** 7

## Accomplishments

- Added "Deploy via Dashboard" callouts in `dokploy.mdx` and `wireguard.mdx` linking to `/templates` (LXC templates)
- Added "Dashboard Infra Catalog" callouts in 5 VM/GPU service docs linking to `/infra` (catalog page)
- MDX build confirms no parse errors — Fumadocs MDX generated in 42ms before expected OOM kill

## Task Commits

Each task was committed atomically:

1. **Task 13-03-01: Add dashboard deploy callout to dokploy.mdx** - `acff44c` (docs)
2. **Task 13-03-02: Add dashboard deploy callout to wireguard.mdx** - `535a3ed` (docs)
3. **Task 13-03-03: Add infra catalog callout to ai/index.mdx** - `aba4bf8` (docs)
4. **Task 13-03-04: Add infra catalog callout to ai/ollama.mdx** - `e7d559d` (docs)
5. **Task 13-03-05: Add infra catalog callout to media/jellyfin.mdx** - `94660f6` (docs)
6. **Task 13-03-06: Add infra catalog callout to gaming/index.mdx** - `e9a37e7` (docs)
7. **Task 13-03-07: Add infra catalog callout to blockchain/lukso-node.mdx** - `3249090` (docs)
8. **Task 13-03-08: Verify MDX build** — no MDX parse errors, OOM kill pre-existing

**Plan metadata:** (see docs commit below)

## Files Created/Modified

- `apps/dashboard/content/docs/deployment/dokploy.mdx` — Added Callout import + "Deploy via Dashboard" callout linking to /templates
- `apps/dashboard/content/docs/networking/wireguard.mdx` — Added Callout import + "Deploy via Dashboard" callout linking to /templates
- `apps/dashboard/content/docs/ai/index.mdx` — Added Callout import + "Dashboard Infra Catalog" callout linking to /infra
- `apps/dashboard/content/docs/ai/ollama.mdx` — Added Callout import + "Dashboard Infra Catalog" callout linking to /infra
- `apps/dashboard/content/docs/media/jellyfin.mdx` — Added Callout import + "Dashboard Infra Catalog" callout linking to /infra
- `apps/dashboard/content/docs/gaming/index.mdx` — Added Callout import + "Dashboard Infra Catalog" callout linking to /infra
- `apps/dashboard/content/docs/blockchain/lukso-node.mdx` — Added Callout import + "Dashboard Infra Catalog" callout linking to /infra

## Decisions Made

- LXC-deployable services (Dokploy, WireGuard Proxy) link to `/templates`; GPU/VM-only services (AI, Jellyfin, Gaming, LUKSO) link to `/infra`
- Callout placed after the Overview paragraph and before the first `##` heading (Prerequisites or Architecture)
- `fumadocs-ui/components/callout` import placed immediately below frontmatter closing `---`, before the first heading

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Build confirmed: `[MDX] generated files in 42.88ms` with no parse errors. OOM kill (SIGKILL) occurred after compilation as documented in STATE.md — pre-existing, non-blocking.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Phase 13 is complete — all 3 plans executed:
- 13-01: LXC templates for Dokploy and WireGuard Proxy
- 13-02: /infra catalog page with 8 service cards
- 13-03: Cross-linking callouts in docs pages

Ready for Phase 14: Infrahaus branding unification.

---
*Phase: 13-infra-template-consolidation*
*Completed: 2026-03-08*
