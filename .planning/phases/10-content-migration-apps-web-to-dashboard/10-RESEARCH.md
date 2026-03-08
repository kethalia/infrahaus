# Phase 10 Research — Content Migration: apps/web → apps/dashboard

## Executive Summary

Phase 10 is a pure file-copy migration. The Fumadocs infrastructure (source.config.ts, MDX pipeline, /docs route group, DocsLayout, source.ts) was fully wired in Phase 09. The only work in Phase 10 is:

1. Copying 29 MDX files + 10 meta.json files from `apps/web/content/docs/` into `apps/dashboard/content/docs/`
2. Replacing the existing placeholder `apps/dashboard/content/docs/index.mdx` with the real index from apps/web
3. No frontmatter changes needed — the frontmatter format is identical between both apps
4. No link changes needed — all internal `/docs/...` links already use the correct absolute paths that work in the dashboard
5. No image assets to migrate — zero image references exist in any of the 29 MDX files
6. The meta.json sidebar navigation files must be copied alongside the MDX files

The migration is low-risk: the destination Fumadocs setup is configured identically to the source.

---

## 1. Source: apps/web/content/docs/ — Complete File Inventory

**Total: 29 MDX files + 10 meta.json files across 9 sections + root**

### Root level

```
apps/web/content/docs/
├── index.mdx                                     # Top-level /docs landing page
└── meta.json                                     # Section ordering (10 sections)
```

Root `meta.json` defines section order:
```json
{
  "pages": [
    "index",
    "getting-started",
    "container-templates",
    "ai",
    "development",
    "deployment",
    "media",
    "gaming",
    "blockchain",
    "networking"
  ]
}
```

### Section breakdown

| Section | MDX files | meta.json pages array |
|---|---|---|
| `getting-started/` | index, proxmox-setup, docker-installation, networking | `["index", "proxmox-setup", "docker-installation", "networking"]` |
| `container-templates/` | index, setup, configuration, credentials, migration, troubleshooting | `["index", "setup", "configuration", "credentials", "migration", "troubleshooting"]` |
| `ai/` | index, ollama, open-webui, kokoro, comfyui | `["index", "ollama", "open-webui", "kokoro", "comfyui"]` |
| `development/` | index, coder, coder-template | `["index", "coder", "coder-template"]` |
| `deployment/` | index, dokploy | `["index", "dokploy"]` |
| `media/` | index, jellyfin | `["index", "jellyfin"]` |
| `gaming/` | index, sunshine-steam | `["index", "sunshine-steam"]` |
| `blockchain/` | index, lukso-node | `["index", "lukso-node"]` |
| `networking/` | index, wireguard | `["index", "wireguard"]` |

**Note on REQUIREMENTS.md vs reality:** REQ-2.02 lists 7 sections (development, networking, container-templates, deployment, blockchain, media, gaming). The actual source has 9 sections — `getting-started` and `ai` are also present. Phase 10 must migrate **all 9 sections**, not just the 7 listed in the requirements. The requirements list was incomplete.

### Complete file paths (all 29 MDX files)

```
apps/web/content/docs/index.mdx
apps/web/content/docs/getting-started/index.mdx
apps/web/content/docs/getting-started/proxmox-setup.mdx
apps/web/content/docs/getting-started/docker-installation.mdx
apps/web/content/docs/getting-started/networking.mdx
apps/web/content/docs/container-templates/index.mdx
apps/web/content/docs/container-templates/setup.mdx
apps/web/content/docs/container-templates/configuration.mdx
apps/web/content/docs/container-templates/credentials.mdx
apps/web/content/docs/container-templates/migration.mdx
apps/web/content/docs/container-templates/troubleshooting.mdx
apps/web/content/docs/ai/index.mdx
apps/web/content/docs/ai/ollama.mdx
apps/web/content/docs/ai/open-webui.mdx
apps/web/content/docs/ai/kokoro.mdx
apps/web/content/docs/ai/comfyui.mdx
apps/web/content/docs/development/index.mdx
apps/web/content/docs/development/coder.mdx
apps/web/content/docs/development/coder-template.mdx
apps/web/content/docs/deployment/index.mdx
apps/web/content/docs/deployment/dokploy.mdx
apps/web/content/docs/media/index.mdx
apps/web/content/docs/media/jellyfin.mdx
apps/web/content/docs/gaming/index.mdx
apps/web/content/docs/gaming/sunshine-steam.mdx
apps/web/content/docs/blockchain/index.mdx
apps/web/content/docs/blockchain/lukso-node.mdx
apps/web/content/docs/networking/index.mdx
apps/web/content/docs/networking/wireguard.mdx
```

---

## 2. Target: apps/dashboard/content/docs/ — Current State

The target directory currently contains only the Phase 09 placeholder:

```
apps/dashboard/content/docs/
└── index.mdx    ← placeholder, must be REPLACED by the real apps/web index.mdx
```

After migration, the target must look exactly like the source tree:

```
apps/dashboard/content/docs/
├── index.mdx
├── meta.json
├── getting-started/
│   ├── meta.json
│   ├── index.mdx
│   ├── proxmox-setup.mdx
│   ├── docker-installation.mdx
│   └── networking.mdx
├── container-templates/
│   ├── meta.json
│   ├── index.mdx
│   ├── setup.mdx
│   ├── configuration.mdx
│   ├── credentials.mdx
│   ├── migration.mdx
│   └── troubleshooting.mdx
├── ai/
│   ├── meta.json
│   ├── index.mdx
│   ├── ollama.mdx
│   ├── open-webui.mdx
│   ├── kokoro.mdx
│   └── comfyui.mdx
├── development/
│   ├── meta.json
│   ├── index.mdx
│   ├── coder.mdx
│   └── coder-template.mdx
├── deployment/
│   ├── meta.json
│   ├── index.mdx
│   └── dokploy.mdx
├── media/
│   ├── meta.json
│   ├── index.mdx
│   └── jellyfin.mdx
├── gaming/
│   ├── meta.json
│   ├── index.mdx
│   └── sunshine-steam.mdx
├── blockchain/
│   ├── meta.json
│   ├── index.mdx
│   └── lukso-node.mdx
└── networking/
    ├── meta.json
    ├── index.mdx
    └── wireguard.mdx
```

---

## 3. Fumadocs Configuration — How It Picks Up Content

### source.config.ts (apps/dashboard/source.config.ts)

```ts
import { defineDocs, defineConfig } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs",
});

export default defineConfig();
```

`dir: "content/docs"` is relative to the project root (`apps/dashboard/`). Any `.mdx` file placed under `apps/dashboard/content/docs/` is automatically discovered. No additional config changes are needed after migration.

### source.ts (apps/dashboard/src/lib/source.ts)

```ts
import { docs } from "fumadocs-mdx:collections/server";
import { loader } from "fumadocs-core/source";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
```

`baseUrl: "/docs"` means a file at `content/docs/getting-started/proxmox-setup.mdx` resolves to the URL `/docs/getting-started/proxmox-setup`. This matches the existing link patterns in the MDX files.

### Page router (apps/dashboard/src/app/(docs)/docs/[[...slug]]/page.tsx)

The catch-all `[[...slug]]` route handles any depth. No route changes needed.

### Sidebar navigation (apps/dashboard/src/app/(docs)/docs/layout.tsx)

```tsx
<DocsLayout tree={source.getPageTree()} nav={{ title: "Infrahaus Docs" }}>
```

`source.getPageTree()` builds the sidebar tree from the `meta.json` files. Once the meta.json files are in place, the sidebar populates automatically — no manual sidebar config is required.

---

## 4. Frontmatter Changes Needed

**None.** The frontmatter format is identical in both apps. All MDX files use the same two-field pattern:

```yaml
---
title: Page Title Here
description: Short description of the page.
---
```

The `page.tsx` in both apps/web and apps/dashboard consumes `page.data.title` and `page.data.description`. No field renames, additions, or removals are required.

---

## 5. Link Updates Needed

**None.** All internal links in the MDX files use absolute paths starting with `/docs/`:

- `/docs/getting-started/docker-installation`
- `/docs/getting-started/proxmox-setup#gpu-passthrough-iommu`
- `/docs/container-templates/setup`
- `/docs/networking/wireguard`
- etc.

Since both apps/web and apps/dashboard serve docs at the `/docs/` base path, all existing links resolve correctly in the dashboard without modification.

**Anchor links** (e.g., `#enable-nvidia-container-toolkit`, `#gpu-passthrough-iommu`) are also safe — they target headings within the target pages which are being migrated verbatim.

**External links** (GitHub, coder.com, proxmox.com, etc.) are absolute URLs — unaffected.

---

## 6. Sidebar / Navigation Configuration

### How meta.json controls the sidebar

Fumadocs reads `meta.json` files in each directory to determine:
- The display order of pages within a section
- The section title (if `"title"` key is present)

The `container-templates/meta.json` is the only one with an explicit title key:
```json
{
  "title": "Container Templates",
  "pages": ["index", "setup", "configuration", "credentials", "migration", "troubleshooting"]
}
```

All other section meta.json files only have `pages` — the section title derives from the section's `index.mdx` frontmatter title.

### Migration action required

All 10 meta.json files must be copied into the dashboard content tree, preserving their directory placement. They are:

```
apps/web/content/docs/meta.json                        → apps/dashboard/content/docs/meta.json
apps/web/content/docs/getting-started/meta.json        → apps/dashboard/content/docs/getting-started/meta.json
apps/web/content/docs/container-templates/meta.json    → apps/dashboard/content/docs/container-templates/meta.json
apps/web/content/docs/ai/meta.json                     → apps/dashboard/content/docs/ai/meta.json
apps/web/content/docs/development/meta.json            → apps/dashboard/content/docs/development/meta.json
apps/web/content/docs/deployment/meta.json             → apps/dashboard/content/docs/deployment/meta.json
apps/web/content/docs/media/meta.json                  → apps/dashboard/content/docs/media/meta.json
apps/web/content/docs/gaming/meta.json                 → apps/dashboard/content/docs/gaming/meta.json
apps/web/content/docs/blockchain/meta.json             → apps/dashboard/content/docs/blockchain/meta.json
apps/web/content/docs/networking/meta.json             → apps/dashboard/content/docs/networking/meta.json
```

---

## 7. Images and Assets

**Zero image assets need migrating.**

A scan of all 29 MDX files found no image references (`![...]()` markdown syntax, `<img>` tags, or `src=` attributes). The content is entirely text-based with ASCII diagrams and code blocks.

The `apps/web` app has no `public/` directory. No static assets (images, icons, PDFs) are referenced by any doc page.

---

## 8. What the Migration Command Looks Like

The migration can be accomplished with a single shell command:

```bash
# From monorepo root:
cp -r apps/web/content/docs/. apps/dashboard/content/docs/
```

This command:
- Overwrites the placeholder `index.mdx` with the real one
- Creates all subdirectories (getting-started/, container-templates/, ai/, etc.)
- Copies all 29 MDX files and all 10 meta.json files
- Preserves directory structure exactly

After running, `apps/dashboard/content/docs/` will contain 39 files (29 MDX + 10 meta.json) in 10 directories.

---

## 9. No Additional Infrastructure Changes Required

Phase 09 completed all infrastructure. Phase 10 requires zero changes to:

- `source.config.ts` — already configured for `content/docs/`
- `next.config.ts` — createMDX() already wrapping
- `tsconfig.json` — MDX paths and `.source/**` already included
- `src/lib/source.ts` — already wired
- `mdx-components.tsx` — already exports getMDXComponents
- `src/app/(docs)/docs/layout.tsx` — DocsLayout already in place
- `src/app/(docs)/docs/[[...slug]]/page.tsx` — catch-all page already in place
- `src/app/api/search/route.ts` — search API already in place
- `src/components/app-sidebar.tsx` — Documentation nav item already added

**The entire phase is file copy + build verification.**

---

## 10. apps/web Source Configuration Reference

For comparison, apps/web uses identical Fumadocs config:

- `source.config.ts`: `defineDocs({ dir: "content/docs" })` + `defineConfig()`
- `source.ts`: `loader({ baseUrl: "/docs", source: docs.toFumadocsSource() })`
- MDX components: same `fumadocs-ui/mdx` defaults
- Same fumadocs-core/fumadocs-ui/fumadocs-mdx package versions (`~15.8.5` / `~14.2.6`)
- `next.config.mjs` wraps with `createMDX()` (dashboard uses `.ts` extension, same effect)

The apps are functionally identical for docs purposes — direct file copy is valid.

---

## Validation Architecture

### Strategy: 3-layer verification

**Layer 1 — File presence check (mechanical, instant)**

After the copy, verify file counts match source:

```bash
# Source count
find apps/web/content/docs -type f | wc -l
# Expected: 39 (29 MDX + 10 meta.json)

# Destination count
find apps/dashboard/content/docs -type f | wc -l
# Expected: 39

# Diff check (should be empty)
diff -rq apps/web/content/docs apps/dashboard/content/docs
```

**Layer 2 — Build verification (catches Fumadocs parsing errors)**

After file copy, run the build:

```bash
pnpm --filter dashboard exec tsc --noEmit
pnpm --filter dashboard lint
NEXT_SKIP_TYPE_CHECK=1 pnpm --filter dashboard build
```

Build success confirms:
- All 29 MDX files parse without errors
- Fumadocs source loader discovers all pages
- `generateStaticParams()` generates routes for all 29 pages
- No broken imports in MDX (no custom JSX components used in content — all pages are plain markdown)

**Layer 3 — Route spot-check (confirms URL correctness)**

After `pnpm dev` starts, verify key routes return 200:

| URL to check | Source file | Validates |
|---|---|---|
| `/docs` | `content/docs/index.mdx` | Root index renders |
| `/docs/getting-started` | `getting-started/index.mdx` | Section index |
| `/docs/getting-started/proxmox-setup` | `getting-started/proxmox-setup.mdx` | Leaf page |
| `/docs/container-templates/configuration` | `container-templates/configuration.mdx` | Deep content page |
| `/docs/ai/ollama` | `ai/ollama.mdx` | Section not in REQ list (validates full migration) |
| `/docs/networking/wireguard` | `networking/wireguard.mdx` | Last section |

Check that each section appears in the Fumadocs sidebar with correct ordering per meta.json.

**Broken link verification strategy:**

All internal `/docs/` links in the MDX files link to pages that are being migrated as part of this phase. No link removal or path remapping is needed. The link correctness guarantee is structural: if all 29 files exist at the correct paths and Fumadocs builds successfully, all `/docs/` links resolve.

To make this explicit, one verification pass can grep for all `/docs/` hrefs in the migrated content and confirm each target path exists as a file:

```bash
# Find all internal /docs/ links
grep -roh '(/docs/[^)"'\''#\s]*)' apps/dashboard/content/docs/ --include="*.mdx" | sort -u

# For each link, check file existence:
# /docs/getting-started/proxmox-setup → content/docs/getting-started/proxmox-setup.mdx
# /docs/container-templates/setup → content/docs/container-templates/setup.mdx
# etc.
```

**Search index verification:**

After build, the Fumadocs search route at `/api/search?query=wireguard` should return results. This confirms the search index was built from all migrated pages (not just the placeholder).

**Sidebar ordering verification:**

Check that sidebar sections appear in the order defined by `content/docs/meta.json`. The root meta.json defines:
`getting-started → container-templates → ai → development → deployment → media → gaming → blockchain → networking`

Visually confirm this matches what renders in the DocsLayout sidebar.

### Regression check

After migration, verify the dashboard's existing routes are unaffected:

```bash
# These routes must still work (no regression from file copy)
GET /          → dashboard home
GET /templates → templates page
GET /settings  → settings page
```

Since content file copy touches only `content/docs/` and no TypeScript source is modified, regressions are extremely unlikely. The build check covers this.

### Acceptance criteria map (REQ-2.02)

| REQ-2.02 Acceptance Criteria | Verification Method |
|---|---|
| All 29 MDX files accessible at `/docs/...` paths | Build `generateStaticParams()` + spot-check 6 URLs |
| No broken links | Structural: all link targets exist as migrated files |
| No missing images | N/A — zero image references in source content |
| MDX frontmatter preserved | `diff -rq` confirms byte-identical file copies |

---

## RESEARCH COMPLETE
