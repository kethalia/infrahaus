---
phase: 13
title: Infra Template Consolidation
researched: 2026-03-08
confidence: HIGH
---

# Phase 13: Infra Template Consolidation — Research

## Summary

Phase 13 wires `infra/` service configs into the dashboard's existing template engine and navigation. The work divides cleanly into three plans: (1) LXC-deployable service templates, (2) a docker-compose service browser, and (3) docs cross-linking. The dashboard already has nearly everything needed — the template engine, docs at `/docs`, and the sidebar. The primary work is content creation (template.conf files, MDX pages) and one new UI surface (the docker-compose browser).

---

## Current State

### What Exists in `infra/`

The repository has ten categories under `infra/`:

| Directory | Type | Services |
|---|---|---|
| `infra/ai/` | Docker-compose | Open WebUI, Ollama, Kokoro TTS, ComfyUI (all GPU) |
| `infra/ai/ollama/` | Docker-compose (standalone) | Ollama only |
| `infra/ai/kokoro/` | Docker-compose (standalone) | Kokoro TTS only |
| `infra/coder/` | Coder Terraform template | Cloud dev workspaces (Terraform + Dockerfile) |
| `infra/docker/` | Docs only | Docker installation reference (README.md, no compose) |
| `infra/dokploy/` | Docker-compose + install.sh | Postgres, Redis, Dokploy app, Traefik (Docker Swarm) |
| `infra/gaming/` | Docker-compose + Dockerfile | Sunshine + Steam (GPU passthrough) |
| `infra/jellyfin/` | Docker-compose | Jellyfin, VPN (gluetun), qbittorrent, prowlarr, radarr, sonarr, bazarr |
| `infra/lukso-node/` | Docker-compose + configs + scripts | Geth, Lighthouse, Prometheus, Grafana |
| `infra/lxc/` | LXC templates | web3-dev (single template with template.conf) |
| `infra/vm/` | VM template scripts | openclaw-desktop (VM, not LXC) |
| `infra/wireguard/` | Docker-compose + wg configs | Nginx Proxy Manager, WireGuard configs |

### What Exists in the Dashboard Template Engine

The template engine (Phase 08) is fully operational:

- **Discovery**: `lib/templates/discovery.ts` scans `infra/lxc/templates/` for directories containing `template.conf`, parses them, and upserts into PostgreSQL.
- **Parser**: `lib/templates/parser.ts` reads bash-style `template.conf` (TEMPLATE_APP, TEMPLATE_TAGS, TEMPLATE_CPU, TEMPLATE_RAM, TEMPLATE_DISK, TEMPLATE_OS, TEMPLATE_VERSION, feature flags).
- **Schema**: `ParsedTemplate` → Prisma `Template` model. Fields: name, description, source (enum: `filesystem | custom`), path, osTemplate, cores, memory, diskSize, unprivileged, nesting, keyctl, fuse, tags.
- **Sub-components**: Scripts (`*.sh` files with numeric prefix), package buckets (`*.apt`/`*.npm`/`*.pip`), config files (with `.path` and `.policy` sidecars).
- **UI**: `/templates` page with DiscoverButton, TemplateCard grid, search/filter. Template detail at `/templates/[id]` with Config/Scripts/Packages/Files tabs.
- **Deployment**: Container creation wizard that uses template data to provision LXC containers via Proxmox API.

### What Exists in Docs

Fumadocs is running at `/docs`. Content is in `apps/dashboard/content/docs/`. The following sections already exist and are relevant to Phase 13:

| Doc path | Covers |
|---|---|
| `/docs/ai/` | Ollama, Kokoro TTS, ComfyUI, Open WebUI (4 pages + index) |
| `/docs/media/` | Jellyfin stack (index + jellyfin.mdx) |
| `/docs/gaming/` | Sunshine/Steam cloud gaming |
| `/docs/blockchain/` | LUKSO node |
| `/docs/deployment/` | Dokploy setup |
| `/docs/networking/` | WireGuard setup |
| `/docs/development/` | Coder cloud dev workspaces |
| `/docs/container-templates/` | LXC template system |

**Key finding**: Almost all the docs cross-linking work for Plan 13-03 already exists. The AI, Jellyfin, gaming, LUKSO, Dokploy, WireGuard, and Coder docs are all migrated and live at their `/docs/` paths. Phase 13-03 is primarily about adding "deploy with dashboard" or "view in dashboard" links within those existing docs.

---

## LXC-Deployable vs Docker-Compose: The Core Classification

Understanding this is the main architectural decision for Phase 13.

### LXC-Deployable (template engine applies)

A service is LXC-deployable if it runs as a systemd service or docker daemon inside an LXC container. The existing `web3-dev` template demonstrates the pattern: it installs Docker inside the LXC, then the service (e.g., Dokploy) runs via `docker compose` inside that container.

**Candidates for LXC template deployment:**

| Service | Rationale |
|---|---|
| `infra/dokploy/` | Dokploy is explicitly a "deployment LXC" per the getting-started docs. Docker Swarm runs inside the LXC. The `install.sh` script makes this very LXC-friendly. |
| `infra/wireguard/` | Nginx Proxy Manager + WireGuard can run inside a privileged LXC with networking capabilities. |

**Not LXC-deployable (GPU requirement):**

| Service | Why not LXC |
|---|---|
| `infra/ai/` | Requires NVIDIA GPU passthrough — only works inside a dedicated VM with PCIe passthrough. |
| `infra/gaming/` | Requires NVIDIA GPU device passthrough (`/dev/nvidia*`). Runs on a VM. |
| `infra/jellyfin/` | GPU transcoding requires NVIDIA device passthrough. Runs on a VM. |
| `infra/lukso-node/` | Requires significant disk (100GB+) and stable networking. Best run on a VM or dedicated host. No GPU, but the complexity of the geth/lighthouse setup plus prometheus/grafana suggests VM. |

**Unclear / worth a template stub:**

| Service | Notes |
|---|---|
| `infra/ai/ollama/` | Standalone (no GPU needed for CPU inference). Could be an LXC template for a low-power Ollama instance. |

### What "LXC template entry" means

For GPU services, the REQUIREMENTS.md says "or is linkable from docs." The practical implementation is:
- GPU services → `source: "custom"` template entry in the DB with a link to docs, OR simply referenced from the docs sidebar
- LXC services → a `template.conf` in `infra/lxc/templates/<name>/`, discovered by the engine

---

## Plan 13-01: Infra Inventory + Dashboard Template Definitions

### Goal
Create `template.conf` files for LXC-deployable infra services, so they appear in the Templates page after "Discover Templates" is clicked.

### What to Build

**1. `infra/lxc/templates/dokploy/template.conf`**

Dokploy is the strongest LXC candidate. The existing `infra/dokploy/install.sh` is a direct bootstrap script. The template should:
- Use a privileged LXC (or unprivileged with nesting for Docker Swarm)
- Scripts: `00-pre-checks.sh`, `01-docker-install.sh` (reuse pattern from web3-dev), `02-dokploy-install.sh` (wraps `infra/dokploy/install.sh` logic)
- Tags: `deployment;docker;swarm;paas`
- Resources: 2 CPU, 2GB RAM, 20GB disk (minimum for Dokploy)

**2. Optional: `infra/lxc/templates/wireguard-proxy/template.conf`**

WireGuard + Nginx Proxy Manager in an LXC. Less critical but straightforward.

**3. "Infra" category tag in Templates page**

The TemplateCard shows tags. Adding consistent tags like `infra;ai;media;gaming;blockchain;deployment` allows filtering. No schema changes needed — tags are a semicolon-delimited string in the existing `Template` model.

**4. No schema migration needed**

The existing `Template` model (with `source: filesystem | custom`) and `template.conf` format (bash key=value) handle everything required. The discovery engine already scans `infra/lxc/templates/` recursively.

### template.conf Format Reference

```bash
TEMPLATE_APP="Dokploy"
TEMPLATE_TAGS="deployment;docker;swarm;paas;infra"
TEMPLATE_DESCRIPTION="Self-hosted PaaS with Docker Swarm, Traefik, Postgres, Redis"
TEMPLATE_CONFIG_PATH="infra/lxc/templates/dokploy/container-configs"
TEMPLATE_CPU="${TEMPLATE_CPU:-2}"
TEMPLATE_RAM="${TEMPLATE_RAM:-2048}"
TEMPLATE_DISK="${TEMPLATE_DISK:-20}"
TEMPLATE_OS="${TEMPLATE_OS:-debian}"
TEMPLATE_VERSION="${TEMPLATE_VERSION:-12}"
TEMPLATE_UNPRIVILEGED="${TEMPLATE_UNPRIVILEGED:-1}"
TEMPLATE_NESTING="${TEMPLATE_NESTING:-1}"
TEMPLATE_KEYCTL="${TEMPLATE_KEYCTL:-0}"
TEMPLATE_FUSE="${TEMPLATE_FUSE:-0}"
```

### Key Risks

- **Docker-inside-LXC reliability**: The `web3-dev` template already does this (nesting=1). Reusing those Docker install scripts is the safe path.
- **Discovery root**: `discoverTemplates()` defaults to `TEMPLATES_ROOT` env var or `../../infra/lxc/templates` relative to `process.cwd()`. New templates in `infra/lxc/templates/dokploy/` are auto-discovered — no code change needed.
- **Nesting vs privileged**: Dokploy uses Docker Swarm. The install.sh uses `docker swarm init`. Docker Swarm in an unprivileged LXC with `nesting=1` generally works but requires testing. If it doesn't, the template can specify `TEMPLATE_UNPRIVILEGED=0`.

---

## Plan 13-02: Docker-Compose Service Browser

### Goal
Add an "Infra" section to the dashboard that lets users view and link to docker-compose configs for GPU/VM services that aren't LXC-deployable.

### What to Build

This is a **new UI surface** — the most significant new code in Phase 13.

**Option A: Static catalog page at `/infra`**

A new dashboard route at `(dashboard)/infra/page.tsx` that renders a static catalog of infra services. Each service card shows:
- Service name and description
- Type badge (docker-compose / LXC / VM)
- Key services/ports
- Links: "View Docs" (→ `/docs/...`) and "View Config" (→ GitHub link or rendered YAML viewer)

This is read-only, no database needed. Content is hardcoded or loaded from a static JSON/TypeScript config.

**Option B: Dynamic compose file reader**

Server component reads `infra/*/docker-compose.yaml` files from the filesystem at request time, parses services, and renders them. Uses the existing `server-only` pattern.

**Recommendation: Option A with a static catalog config**

A TypeScript config file at `lib/infra/catalog.ts` (server-only, filesystem data) defines the services. The catalog is static but easy to update. Avoids YAML parsing complexity in the dashboard and keeps clear separation between config files and the app.

### Proposed Route Structure

```
src/app/(dashboard)/infra/
├── page.tsx           — Catalog overview: cards for each infra category
└── loading.tsx        — Skeleton loader
```

### Sidebar Integration (REQ-2.06)

The `app-sidebar.tsx` currently has: Dashboard, Templates, Packages, Documentation, Settings.

Add "Infra" nav item between Templates and Documentation:
```typescript
{
  title: "Infra",
  href: "/infra",
  icon: Server,  // from lucide-react
}
```

The isActive pattern already handles this correctly.

### Infra Catalog Data Structure

```typescript
// lib/infra/catalog.ts
export interface InfraService {
  id: string;
  name: string;
  description: string;
  category: "ai" | "media" | "gaming" | "blockchain" | "deployment" | "networking" | "development";
  deployType: "docker-compose" | "lxc" | "vm" | "terraform";
  composePath?: string;       // relative path from repo root
  docsPath?: string;          // /docs/... path
  services: string[];         // list of docker service names
  requiresGpu: boolean;
  tags: string[];
}
```

### Key Risks

- **Scope creep**: Plan 13-02 should stay minimal — a read-only browsable catalog, not a full deployment UI. The deployment path is: view in dashboard → deploy via template engine (LXC) or follow docs (docker-compose).
- **No file-system parsing at runtime needed**: The catalog can simply embed the key facts (service names, ports, paths) as static TypeScript. The YAML files don't need to be parsed dynamically.
- **shadcn-first**: Service cards should use shadcn `Card` components. The existing `TemplateCard` pattern is a good reference.

---

## Plan 13-03: Infra Docs Cross-Linking

### Goal
Link each infra service's docs page to the dashboard (for LXC-deployable services) or to the config files (for docker-compose services). Also add a "Templates" reference link in container-templates docs.

### Current State of Docs Coverage

| Service | Doc path | Has infra config reference? |
|---|---|---|
| AI stack | `/docs/ai/` | Partially — references `infra/ai/docker-compose.yaml` inline |
| Ollama | `/docs/ai/ollama` | References compose file inline |
| Kokoro | `/docs/ai/kokoro` | References compose file inline |
| Jellyfin | `/docs/media/jellyfin` | References `infra/jellyfin/docker-compose.yaml` |
| Gaming | `/docs/gaming/` | References `infra/gaming/docker-compose.yaml` |
| LUKSO node | `/docs/blockchain/lukso-node` | References `infra/lukso-node/` |
| Dokploy | `/docs/deployment/dokploy` | References `infra/dokploy/docker-compose.yaml` |
| WireGuard | `/docs/networking/wireguard` | References `infra/wireguard/docker-compose.yaml` |
| Coder | `/docs/development/` | References `infra/coder/` |

**Most docs already reference the config files inline.** The missing piece is the **reverse link**: pointing from the service's docs page to the Templates section in the dashboard (for LXC-deployable services) or to the Infra section (for docker-compose services).

### What to Add

1. **For LXC-deployable services** (dokploy, wireguard-proxy): Add a callout/note to their docs page linking to `/templates?tags=deployment` or `/templates?search=dokploy`.

2. **For docker-compose services** (ai, gaming, jellyfin, lukso-node): Add a callout linking to `/infra` — the new catalog page from Plan 13-02.

3. **Container-templates docs**: Add cross-links to `/docs/deployment/dokploy` and other service docs that can be deployed via LXC templates.

4. **Fumadocs note**: Fumadocs supports MDX `<Callout>` components. The existing docs already use standard Markdown. Adding a Fumadocs callout for "Deploy via Dashboard" is straightforward.

### Effort Level

Low — mostly MDX edits. No new routes, no new components. The main content (docs pages) already exists.

---

## Dependency Analysis

### Phase 08 (Complete)
Template engine, discovery, parser, schemas — all exist. No gaps.

### Phase 09 (Complete)
Fumadocs at `/docs` with full navigation — all exists. No gaps.

### Phase 10 (Complete)
All docs content migrated. All service docs exist in `content/docs/`. Plan 13-03 can proceed immediately.

### Phase 12 (Complete)
`apps/web` deleted. No dependency issues.

### Phase 11 (New documentation — not started)
Phase 13 depends on Phase 11 for REQ-2.03 (new docs). However, the Phase 11 docs (Proxmox setup, API tokens, node config) are orthogonal to the infra service docs. Phase 13 can proceed without Phase 11 being complete, since the infra service docs are already in place.

**Conclusion**: Phase 13 can start immediately.

---

## Technical Constraints and Patterns

### server-only Policy
Any new `lib/infra/` module that reads the filesystem must have `import "server-only"`. Catalog data that is purely static TypeScript config does not need it.

### shadcn-first
All new UI in the Infra catalog page must use shadcn `Card`, `Badge`, `Button`. No custom div wrappers for card-like patterns. The TemplateCard in `src/components/templates/template-card.tsx` is the model to follow.

### Route Group Convention
New dashboard pages go in `src/app/(dashboard)/infra/`. The dashboard layout in `(dashboard)/layout.tsx` wraps everything automatically.

### No New DB Models
Neither the catalog page nor the docs cross-linking requires database changes. The existing `Template` model covers LXC templates. Docker-compose services are read-only static catalog entries.

### Tags as the Integration Point
The template engine uses semicolon-delimited tags. Adding consistent infra tags (e.g., `infra;deployment;docker`) to new `template.conf` files enables filtering on `/templates?tags=infra` without any code changes to the filtering logic.

---

## Infra Service Classification Summary

| Service | Deploy Type | Dashboard Treatment | Docs Already Exist? |
|---|---|---|---|
| `infra/ai/` (full stack) | Docker-compose (VM) | Catalog entry in /infra | Yes (`/docs/ai/`) |
| `infra/ai/ollama/` | Docker-compose (standalone) | Could be LXC template (CPU-only mode) | Yes (`/docs/ai/ollama`) |
| `infra/coder/` | Terraform (Coder) | Catalog entry — docs-only | Yes (`/docs/development/`) |
| `infra/docker/` | Install docs | Docs-only reference | Via getting-started |
| `infra/dokploy/` | Docker Swarm → LXC | LXC template entry + catalog | Yes (`/docs/deployment/dokploy`) |
| `infra/gaming/` | Docker-compose (VM, GPU) | Catalog entry in /infra | Yes (`/docs/gaming/`) |
| `infra/jellyfin/` | Docker-compose (VM, GPU) | Catalog entry in /infra | Yes (`/docs/media/jellyfin`) |
| `infra/lukso-node/` | Docker-compose (VM) | Catalog entry in /infra | Yes (`/docs/blockchain/lukso-node`) |
| `infra/lxc/` | LXC template | Already in template engine | Yes (`/docs/container-templates/`) |
| `infra/vm/` | VM scripts | Docs-only (out of scope) | Via getting-started |
| `infra/wireguard/` | Docker-compose → LXC possible | LXC template + catalog | Yes (`/docs/networking/wireguard`) |

---

## Open Questions for Planning

1. **Wireguard LXC template scope**: The `wireguard/docker-compose.yaml` runs Nginx Proxy Manager. This is useful as an LXC template for the networking role. Should Plan 13-01 include it, or defer to a follow-up?

2. **Ollama standalone LXC template**: An Ollama-only template (CPU inference, no GPU) would be a genuinely useful LXC template for lower-end setups. Scope question for Plan 13-01.

3. **Infra catalog page depth**: Should `/infra` be a single summary page or have per-service sub-routes (`/infra/ai`, `/infra/jellyfin`, etc.)? Given the docs already cover service details, a single summary page with links to docs is likely sufficient.

4. **REQ-2.06 sidebar label**: The requirement says "Infra Templates section (or merged into existing Templates)". Plan 13-02's `/infra` route satisfies this. Alternatively, a sub-section within `/templates?tags=infra` could work, avoiding a new nav item. Decision for planning.

5. **Template.conf for docker-compose wrapped in LXC**: For dokploy, the scripts inside the LXC will run `docker compose up` from `infra/dokploy/`. Should the scripts reference the repo path (and clone it), or copy the compose file into the template? The `web3-dev` pattern references repo paths — this is the established pattern.

---

## Validation Architecture

### What Can Be Tested Automatically

**Unit tests (no infrastructure needed):**
- Parser tests: `lib/templates/parser.ts` has pure functions. New `template.conf` files for infra services can be parsed in unit tests to verify all fields are extracted correctly. Pattern: create a test fixture in `tests/` mirroring the template.conf format.
- Catalog type safety: The TypeScript static catalog (`lib/infra/catalog.ts`) is validated at compile time via `tsc --noEmit`. All `InfraService` objects must satisfy the interface.
- Schema validation: Zod schemas in `lib/templates/schemas.ts` don't change, but any new server actions can be tested with mock inputs.

**Build-time checks:**
- `tsc --noEmit` — catches type errors in new server components, catalog types, and any new lib modules.
- ESLint via `pnpm lint` — catches import violations and style issues.
- Fumadocs build (`NEXT_SKIP_TYPE_CHECK=1 next build`) — validates that new MDX pages (if any are added for Plan 13-03) are well-formed and generate correctly. Catches missing frontmatter, broken MDX syntax.

**Template discovery (integration, requires DB):**
- Running `discoverTemplatesAction` after creating new `template.conf` files confirms they are parsed and upserted correctly. The `DiscoverButton` in the dashboard UI triggers this. Results visible immediately in the Templates page grid.

### What Requires Manual / Visual Verification

**Plan 13-01 (LXC templates):**
- Template cards appear on `/templates` after clicking "Discover Templates"
- Tags display correctly and filtering works (`?tags=infra` shows only infra templates)
- Template detail page shows correct config values (CPU, RAM, disk, OS)
- Container creation wizard can be initiated from the new template (no actual Proxmox required to verify the form pre-population)

**Plan 13-02 (Infra catalog page):**
- `/infra` route renders without errors
- All service cards display correct names, descriptions, and type badges
- "View Docs" links navigate to the correct `/docs/...` paths
- "View Config" links (if implemented) point to the correct repo paths
- Sidebar shows "Infra" nav item with correct active state
- Responsive layout on mobile viewport

**Plan 13-03 (Docs cross-linking):**
- Each modified MDX page renders without errors in `/docs/`
- Callout boxes display correctly with Fumadocs styling
- Links to `/templates` and `/infra` are functional (dashboard routes)
- Fumadocs sidebar still shows correct navigation tree after any new pages

### Key Test Scenarios (Nyquist Validation Strategy)

The Nyquist strategy tests a representative sample that covers all distinct code paths rather than exhaustive permutations.

**Scenario 1: New template discovery (Plan 13-01)**
- Add `infra/lxc/templates/dokploy/template.conf` with all required fields
- Click "Discover Templates" in the dashboard
- Verify: template appears in grid with correct name, tags, and resource summary
- Verify: template detail page shows correct osTemplate, cores, memory, diskSize, unprivileged, nesting values
- This validates the parser-to-DB pipeline for any new `template.conf`

**Scenario 2: Infra catalog page renders (Plan 13-02)**
- Navigate to `/infra`
- Verify: page loads without 500 error
- Verify: at least one service card from each deploy type (docker-compose, lxc) is visible
- Verify: "View Docs" link for one service navigates correctly

**Scenario 3: Sidebar nav item (Plans 13-02 and REQ-2.06)**
- Navigate to `/infra` — "Infra" nav item is active
- Navigate to `/templates` — "Templates" nav item is active, "Infra" is not
- Navigate to `/docs` — "Documentation" is active, "Infra" is not

**Scenario 4: Docs cross-link (Plan 13-03)**
- Navigate to `/docs/deployment/dokploy`
- Verify: callout or link pointing to `/templates` or `/infra` is visible and functional
- Navigate to `/docs/ai/ollama`
- Verify: callout or link pointing to `/infra` is visible

**Scenario 5: Tag-based template filtering (Plan 13-01)**
- After discovery, navigate to `/templates?tags=infra`
- Verify: only infra-tagged templates appear (not web3-dev)
- Clear filter → all templates visible

**Scenario 6: Type-check passes (all plans)**
- `pnpm --filter dashboard exec tsc --noEmit` passes with exit 0
- No new TypeScript errors introduced

**Scenario 7: Build validates MDX (Plan 13-03)**
- `NEXT_SKIP_TYPE_CHECK=1 pnpm --filter dashboard exec next build` (or the equivalent build command used in this repo) completes without MDX parse errors
- Note: OOM kill of the TypeScript worker during `next build` is pre-existing and non-blocking (documented in STATE.md)

---

## Files to Create or Modify

### Plan 13-01

New files:
- `infra/lxc/templates/dokploy/template.conf`
- `infra/lxc/templates/dokploy/container-configs/scripts/00-pre-checks.sh`
- `infra/lxc/templates/dokploy/container-configs/scripts/01-docker-install.sh`
- `infra/lxc/templates/dokploy/container-configs/scripts/02-dokploy-install.sh`
- `infra/lxc/templates/dokploy/container-configs/packages/base.apt`
- (Optional) `infra/lxc/templates/wireguard-proxy/template.conf` + scripts

No dashboard code changes needed — discovery engine handles new templates automatically.

### Plan 13-02

New files:
- `apps/dashboard/src/lib/infra/catalog.ts` (server-only static catalog)
- `apps/dashboard/src/app/(dashboard)/infra/page.tsx`
- `apps/dashboard/src/app/(dashboard)/infra/loading.tsx`
- `apps/dashboard/src/components/infra/infra-service-card.tsx`

Modified files:
- `apps/dashboard/src/components/app-sidebar.tsx` (add "Infra" nav item)

### Plan 13-03

Modified files (MDX cross-links):
- `apps/dashboard/content/docs/deployment/dokploy.mdx` (add template link)
- `apps/dashboard/content/docs/ai/index.mdx` or `ollama.mdx` (add infra catalog link)
- `apps/dashboard/content/docs/media/jellyfin.mdx` (add infra catalog link)
- `apps/dashboard/content/docs/gaming/index.mdx` (add infra catalog link)
- `apps/dashboard/content/docs/blockchain/lukso-node.mdx` (add infra catalog link)
- `apps/dashboard/content/docs/networking/wireguard.mdx` (add template/infra link)

---

## Sources

All findings are grounded in direct codebase inspection (2026-03-08):

- `apps/dashboard/src/lib/templates/discovery.ts` — discovery engine, default templates root
- `apps/dashboard/src/lib/templates/parser.ts` — template.conf parsing logic
- `apps/dashboard/prisma/schema.prisma` — Template model, TemplateSource enum
- `apps/dashboard/src/components/app-sidebar.tsx` — current nav items
- `apps/dashboard/src/app/(dashboard)/templates/page.tsx` — templates page UI
- `apps/dashboard/content/docs/` — all existing docs content
- `infra/lxc/templates/web3-dev/template.conf` — template.conf format reference
- `infra/*/docker-compose.yaml` — all infra service configs
- `.planning/REQUIREMENTS.md` — REQ-2.05, REQ-2.06
- `.planning/STATE.md` — Phase 08 and 09 decisions carried forward
