# Infrahaus — Roadmap

## Overview

Infrahaus is a Proxmox LXC container management platform. `apps/dashboard` is the centrepiece — a full-stack Next.js 15 web app that manages containers, templates, documentation, and infra configs in one place.

---

## ✅ Milestone v1.0 — LXC Template Manager Dashboard (COMPLETE)

**Completed:** 2026-03-08 | **Tag:** v1.0 | **Branch:** oscar/milestone-1

Phases 01–08 complete. See `.planning/milestones/v1.0-ROADMAP.md` for full archive.

Summary:
- Foundation (Next.js 15 + Prisma + Redis + Web3 auth)
- Template system, container creation wizard, container management
- Multi-node Proxmox support with pool-based access control
- Web UI monitoring (RRD charts, service discovery)
- CI/CD pipeline + Docker deployment
- VM template for OpenClaw + LXC container template engine (forge-shield)

---

## 🚀 Milestone v2.0 — Dashboard as Hub (ACTIVE)

**Branch:** oscar/milestone-2
**Goal:** Make `apps/dashboard` the centrepiece of the entire repo.

### Phase 09: Docs Integration — Fumadocs in Dashboard ✅ COMPLETE

**Goal:** Add Fumadocs to `apps/dashboard`. Create `/docs` route with navigation, search, and theme matching the dashboard.
**Depends on:** Phase 08 (complete)
**Status:** Complete (2026-03-08)
**Plans:** 3/3 plans executed

Key deliverables:
- Fumadocs installed as dependency of apps/dashboard (fumadocs-core, fumadocs-ui, fumadocs-mdx) ✅
- `/docs` App Router route group with Fumadocs layout ✅
- source.config.ts configured for MDX content directory ✅
- Full-text search (Fumadocs Search) ✅
- Sidebar added to dashboard sidebar: "Documentation" link with startsWith isActive ✅
- Dark/light mode matching existing dashboard theme ✅

Plans:
- [x] 09-01-PLAN.md — Install Fumadocs + configure source.config.ts + /docs route group
- [x] 09-02-PLAN.md — Fumadocs layout (sidebar, breadcrumbs, search, theme integration)
- [x] 09-03-PLAN.md — Dashboard sidebar integration + navigation unification

Requirements: REQ-2.01, REQ-2.06

---

### Phase 10: Content Migration — apps/web → apps/dashboard

**Goal:** Migrate all 29 MDX files from `apps/web/content/docs/` into `apps/dashboard`. Verify no broken links.
**Depends on:** Phase 09
**Status:** Not started
**Plans:** 2/2 plans complete

Key deliverables:
- All existing docs sections migrated:
  - development/ (Coder template, Coder setup)
  - networking/ (WireGuard)
  - container-templates/ (credentials, setup, configuration, troubleshooting, migration)
  - deployment/ (Dokploy)
  - blockchain/ (LUKSO node)
  - media/ (Jellyfin)
  - gaming/ (Sunshine/Steam)
- All MDX frontmatter and links updated
- Source migrated from apps/web → apps/dashboard/content/docs/

Plans:
- [ ] 10-01-PLAN.md — Migrate all 29 MDX files + update internal links
- [ ] 10-02-PLAN.md — Verify links, images, navigation structure

Requirements: REQ-2.02

---

### Phase 11: New Documentation

**Goal:** Write new docs that don't exist yet — covering critical processes for Infrahaus users.
**Depends on:** Phase 10
**Status:** Not started
**Plans:** 2 plans

Key deliverables:
- Proxmox API token creation guide (step-by-step)
- Initial Proxmox VE setup guide (for new users)
- Node configuration guide (adding nodes to dashboard)
- Template creation guide
- Container deployment walkthrough (end-to-end)
- Forge-shield template reference (from Phase 08 engine README)

Plans:
- [ ] 11-01-PLAN.md — Proxmox setup docs (API tokens, VE setup, node config)
- [ ] 11-02-PLAN.md — Dashboard workflow docs (template creation, container deployment, forge-shield)

Requirements: REQ-2.03

---

### Phase 12: apps/web Removal

**Goal:** Delete `apps/web` from the monorepo. Clean up workspace config.
**Depends on:** Phase 10, 11
**Status:** Not started
**Plans:** 1/1 plans complete

Key deliverables:
- `apps/web/` directory removed
- `pnpm-workspace.yaml` updated
- `turbo.json` updated (remove web pipeline)
- CI/CD updated (no more web build job)
- Root README updated

Plans:
- [ ] 12-01-PLAN.md — Remove apps/web, update workspace + CI + README

Requirements: REQ-2.04

---

### Phase 13: Infra Template Consolidation

**Goal:** Wire `infra/` service configs into the dashboard template engine. Infra configs become first-class dashboard objects.
**Depends on:** Phase 08 (template engine), Phase 12
**Status:** Not started
**Plans:** 3 plans

Key deliverables:
- Survey all infra/ categories: ai/, docker/, gaming/, jellyfin/, lukso-node/, wireguard/, dokploy/
- Each infra service gets a dashboard template entry (or docs link where LXC isn't applicable)
- Docker-compose services linkable/viewable from dashboard infra section
- Infra templates discoverable from dashboard Templates page
- Where applicable: infra configs deployable via template engine

Plans:
- [ ] 13-01-PLAN.md — Infra inventory + dashboard template definitions for LXC-deployable services
- [ ] 13-02-PLAN.md — Docker-compose service browser (view/link configs from dashboard)
- [ ] 13-03-PLAN.md — Infra docs (link each infra service to its docs page in the migrated docs)

Requirements: REQ-2.05, REQ-2.06

---

### Phase 14: Branding + Polish

**Goal:** Unify Infrahaus branding throughout. Final polish before v2.0 ships.
**Depends on:** Phase 12, 13
**Status:** Not started
**Plans:** 1 plan

Key deliverables:
- Dashboard title → "Infrahaus"
- Favicon updated
- Root README → "Infrahaus" with updated architecture diagram
- apps/dashboard package.json name → "@infrahaus/dashboard"
- Consistent naming throughout all docs

Plans:
- [ ] 14-01-PLAN.md — Rename to Infrahaus: dashboard metadata, README, package names

Requirements: REQ-2.07

---

## Phase Summary (v2.0)

| Phase | Description | Plans | Status |
|-------|-------------|-------|--------|
| 09 | Fumadocs integration in dashboard | 3/3 | Complete ✅ |
| 10 | 2/2 | Complete    | 2026-03-08 |
| 11 | New documentation | 2 | Not started |
| 12 | apps/web removal | Complete    | 2026-03-08 |
| 13 | Infra template consolidation | 3 | Not started |
| 14 | Branding + polish | 1 | Not started |
| **Total** | | **12** | **3/12** |
