---
milestone: v2.0
milestone_name: Dashboard as Hub
created: 2026-03-08
status: planning
---

# Requirements — v2.0 Dashboard as Hub

## Vision

Make `apps/dashboard` the centrepiece of the entire Infrahaus monorepo.
All documentation, infra configs, and tools converge into the dashboard app.
The separate `apps/web` Fumadocs site goes away. Everything lives in or is accessible from `/` dashboard.

---

## Requirements

### REQ-2.01 — Docs Infrastructure in Dashboard

**Priority:** P0 (must-have)
**Description:** Integrate Fumadocs (or equivalent MDX docs framework) into `apps/dashboard` so documentation lives at `/docs` within the same Next.js app.
**Acceptance:**
- `/docs` route renders documentation from MDX source files
- Docs sidebar navigation works (sections, pages)
- Full-text search functional (Fumadocs Search or equivalent)
- Dark/light mode matches dashboard theme
- Docs framework installed as a dependency of `apps/dashboard` (not a separate app)

---

### REQ-2.02 — Content Migration from apps/web

**Priority:** P0 (must-have)
**Description:** All 29 existing MDX files from `apps/web/content/docs/` migrated into `apps/dashboard`.
**Sections to migrate:**
- development/ (Coder template, Coder setup)
- networking/ (index, WireGuard)
- container-templates/ (credentials, setup, configuration, troubleshooting, migration)
- deployment/ (Dokploy)
- blockchain/ (LUKSO node)
- media/ (Jellyfin)
- gaming/ (Sunshine/Steam)
**Acceptance:**
- All 29 MDX files accessible at equivalent `/docs/...` paths in dashboard
- No broken links or missing images
- MDX frontmatter preserved

---

### REQ-2.03 — New Documentation

**Priority:** P1 (should-have)
**Description:** New documentation that doesn't exist yet, covering processes critical to using the dashboard.
**Required new docs:**
- Proxmox API token creation (step-by-step with screenshots)
- Initial Proxmox VE setup guide (for new users)
- Node configuration guide (adding nodes to dashboard)
- Template creation guide (using the dashboard template system)
- Container deployment walkthrough (end-to-end from template to running container)
- Forge-shield template reference (from Phase 08 engine README)
**Acceptance:**
- Each doc complete with accurate steps
- Cross-linked with related docs

---

### REQ-2.04 — apps/web Removal

**Priority:** P0 (must-have)
**Description:** Remove `apps/web` from the monorepo once docs are migrated.
**Acceptance:**
- `apps/web/` directory deleted
- `pnpm-workspace.yaml` updated to remove web
- `turbo.json` updated to remove web references
- No dangling imports or CI references
- Root README updated to reflect single-app structure

---

### REQ-2.05 — Infra Template Integration

**Priority:** P1 (should-have)
**Description:** `infra/` service configs become manageable through the dashboard's template engine.
**Infra categories to integrate:**
- `infra/ai/` — Ollama, Kokoro docker-compose configs
- `infra/docker/` — reusable compose patterns
- `infra/gaming/` — Sunshine/Steam
- `infra/jellyfin/` — media server
- `infra/lukso-node/` — blockchain node
- `infra/wireguard/` — networking
- `infra/dokploy/` — deployment platform
**Acceptance:**
- Each infra/ service has a corresponding dashboard template or is linkable from docs
- Users can browse infra templates from the dashboard templates section
- Infra configs can be deployed as LXC containers (where applicable) via template engine

---

### REQ-2.06 — Unified Navigation

**Priority:** P1 (should-have)
**Description:** Dashboard sidebar includes docs link and infra templates section. Navigation is coherent.
**Acceptance:**
- Sidebar includes "Documentation" link → `/docs`
- Sidebar shows "Infra Templates" section (or merged into existing Templates)
- Breadcrumbs work correctly for /docs/** paths
- Responsive layout maintained

---

### REQ-2.07 — Branding Unification

**Priority:** P2 (nice-to-have)
**Description:** Rename product to "Infrahaus" throughout the dashboard, docs, and README.
**Acceptance:**
- Dashboard title/favicon updated to "Infrahaus"
- Root README updated
- apps/dashboard package name updated
- Consistent Infrahaus naming throughout docs

---

## Traceability

| REQ-ID | Description | Phase | Status |
|--------|-------------|-------|--------|
| REQ-2.01 | Fumadocs integration in dashboard | Phase 09 | [x] |
| REQ-2.02 | Content migration from apps/web | Phase 09-10 | [x] |
| REQ-2.03 | New documentation | Phase 11 | [x] |
| REQ-2.04 | apps/web removal | Phase 12 | [x] |
| REQ-2.05 | Infra template integration | Phase 13 | [x] |
| REQ-2.06 | Unified navigation | Phase 09+13 | [x] |
| REQ-2.07 | Branding unification | Phase 14 | [x] |
