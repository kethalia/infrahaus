---
phase: 12
title: apps/web Removal — Research
status: complete
date: 2026-03-08
---

# Phase 12 Research — apps/web Removal

## Summary

Phase 12 deletes `apps/web` from the monorepo and cleans up all references to it. The content migration (Phase 10) is already complete — `apps/dashboard/content/docs/` has an identical file set to `apps/web/content/docs/`. This phase is purely deletion and cleanup.

---

## 1. What apps/web Contains

### Source files (non-generated, non-content)

```
apps/web/
├── app/
│   ├── (home)/layout.tsx
│   ├── (home)/page.tsx
│   ├── api/search/route.ts
│   ├── docs/[[...slug]]/page.tsx
│   ├── docs/layout.tsx
│   ├── global.css
│   └── layout.tsx
├── lib/
│   ├── layout.shared.tsx
│   └── source.ts
├── content/docs/           ← already fully mirrored in apps/dashboard/content/docs/
├── eslint.config.mjs
├── mdx-components.tsx
├── next-env.d.ts
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── source.config.ts
└── tsconfig.json
```

### Generated/runtime directories (ignored by git, can be deleted freely)

- `apps/web/node_modules/` — workspace-installed deps
- `apps/web/.source/` — Fumadocs MDX generation output (git-ignored per `.gitignore`)
- `apps/web/.next/` — Next.js build output (git-ignored)

### Content files

All 39 MDX and `meta.json` files in `apps/web/content/docs/` are already present (and identical) in `apps/dashboard/content/docs/`. Confirmed with `diff -rq` — no differences.

---

## 2. pnpm-workspace.yaml

Current content:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

The glob `"apps/*"` includes `apps/web` automatically. Once `apps/web/` is deleted, the glob still works correctly — no change to `pnpm-workspace.yaml` is required.

**Important:** After deleting `apps/web/`, run `pnpm install` to regenerate `pnpm-lock.yaml` so the `apps/web:` stanza (line 190) is removed from the lockfile.

---

## 3. turbo.json

Current content references only generic task definitions (`build`, `dev`, `lint`). There are no `web`-specific pipeline entries, no `filter` blocks, and no per-package overrides.

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "!.next/cache/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^lint"] }
  }
}
```

**No changes required to `turbo.json`.**

---

## 4. CI/CD — .github/workflows/

Two workflow files exist:

### ci.yml

All jobs (`lint`, `format`, `build`, `test`, `docker-build`, `e2e`) use workspace-wide or `--filter dashboard` commands. None reference `web` by name:

- `pnpm lint` — runs turbo lint across all workspace packages
- `pnpm build` — runs turbo build across all workspace packages
- `pnpm --filter dashboard test` — explicitly scoped to dashboard
- `docker build -t infrahaus-test .` — builds root Dockerfile (dashboard-only)

After removing `apps/web`, `pnpm lint` and `pnpm build` will simply have one fewer package to process. **No changes required to `ci.yml`.**

### test-config-manager.yml

Scoped to `infra/lxc/**` paths — no web references. **No changes needed.**

---

## 5. Root Dockerfile and docker-compose.yml

The root `Dockerfile` only installs and builds `apps/dashboard`. It explicitly copies only `apps/dashboard/package.json` in the `deps` stage. **No changes needed.**

The `docker-compose.yml` uses the root Dockerfile with `--filter dashboard`. **No changes needed.**

---

## 6. Root README.md

The root `README.md` is outdated — it still describes the repo as a docs site (`apps/web`) with no mention of `apps/dashboard`. It must be rewritten for Phase 12 to:

- Remove the `apps/web` entry from the monorepo structure diagram
- Add `apps/dashboard` as the centrepiece application
- Remove "Start the docs site in development mode" from Quick Start
- Update Quick Start to describe the dashboard (port 3002)
- Update Tech Stack section (remove "Docs: Next.js 15, Fumadocs..." for apps/web, add dashboard stack)
- Update Contributing instructions (`pnpm build` verification still valid but context changes)

Current README lines requiring update:
- Line 3: Describes repo as a Fumadocs site for home lab — needs reframe as dashboard
- Lines 7-23: Monorepo structure (remove `apps/web/`, add `apps/dashboard/`)
- Lines 34-44: Quick Start dev command references docs site at port 3000
- Lines 71-72: Tech Stack references Fumadocs as a docs site tech

---

## 7. infra/lxc/docs/SETUP.md

Line 373 contains a hardcoded relative link to apps/web content:

```
See [Networking documentation](../../../apps/web/content/docs/getting-started/networking.mdx) for Nginx Proxy Manager setup.
```

This link will become broken after deletion. It should be updated to point to the live `/docs/getting-started/networking` route on the dashboard, or use a relative path to the migrated file in `apps/dashboard/content/docs/`.

---

## 8. .planning/ Documentation

Multiple planning files reference `apps/web` (ARCHITECTURE.md, STACK.md, STRUCTURE.md, CONVENTIONS.md, STATE.md, REQUIREMENTS.md, ROADMAP.md). These are planning artifacts — they should not be modified as part of Phase 12 (historical context). The planning docs describe the system as it was, and later phases (e.g., Phase 14 branding) can update them if desired.

---

## 9. Cross-Package Dependencies

`apps/dashboard/package.json` has **no dependency on `apps/web`** — no `workspace:*` reference, no import from `web`. The two apps are architecturally independent. Removing `apps/web` will not break any import in `apps/dashboard`.

Confirmed: `grep` across all `apps/dashboard` TypeScript and config files finds zero references to `apps/web` or the `web` package name.

---

## 10. Safe Deletion Strategy for pnpm Monorepo

The correct deletion sequence for a pnpm monorepo:

1. **Delete the directory:** `rm -rf apps/web`
2. **Reinstall dependencies:** `pnpm install` — this regenerates `pnpm-lock.yaml` without the `apps/web:` stanza
3. **Verify lockfile:** confirm `apps/web` no longer appears in `pnpm-lock.yaml`
4. **Update README.md** — rewrite to reflect dashboard-centric repo
5. **Fix SETUP.md link** — update the hardcoded `apps/web/content/docs/` reference in `infra/lxc/docs/SETUP.md`
6. **Verify build** — run `pnpm --filter dashboard build` (or `pnpm build`) to confirm nothing broke

Do NOT need to:
- Change `pnpm-workspace.yaml` (glob still works with one fewer app)
- Change `turbo.json` (no web-specific entries)
- Change any CI workflow files (no web-specific jobs)
- Change `Dockerfile` or `docker-compose.yml` (dashboard-only already)

---

## 11. Key Risk: apps/web node_modules Size

`apps/web/node_modules/` exists and contains a full Next.js + Fumadocs install. `rm -rf apps/web` will remove it, but on slow filesystems this may take a few seconds. No special handling needed — standard `rm -rf`.

---

## Validation Architecture

### Deliverable 1: apps/web/ directory removed

- **Check:** `ls apps/web` → should return "No such file or directory"
- **Check:** `git status` → `apps/web/` files should appear as deleted (or absent if already untracked)
- **Check:** `find . -path ./node_modules -prune -o -name "*.tsx" -print | grep apps/web` → zero results

### Deliverable 2: pnpm-workspace.yaml correct

- **Check:** `cat pnpm-workspace.yaml` — still reads `apps/*` and `packages/*` (unchanged)
- **Check:** `pnpm install` completes without error after deletion
- **Check:** `grep "apps/web" pnpm-lock.yaml` → zero matches (lockfile regenerated)

### Deliverable 3: turbo.json correct (no web pipeline)

- **Check:** `cat turbo.json` — no `web` or `apps/web` references (already none; verify unchanged)
- **Check:** `pnpm build` runs successfully using turbo (only dashboard builds)

### Deliverable 4: CI/CD correct (no web build job)

- **Check:** `grep -r "web" .github/workflows/` → no references to web package or apps/web
- **Check:** Both workflow files remain unchanged (they already don't reference web)

### Deliverable 5: Root README updated

- **Check:** `grep "apps/web" README.md` → zero matches
- **Check:** README monorepo diagram shows `apps/dashboard/` not `apps/web/`
- **Check:** Quick Start section references dashboard (port 3002), not docs site (port 3000)

### Deliverable 6: No dangling references to apps/web

Run the following sweep to confirm all non-planning references are cleared:

```bash
# Check all source/config files (exclude planning and node_modules)
grep -r "apps/web" . \
  --include="*.ts" --include="*.tsx" --include="*.mjs" \
  --include="*.json" --include="*.yaml" --include="*.yml" \
  --include="*.md" \
  --exclude-dir=node_modules --exclude-dir=".next" \
  --exclude-dir=".planning"
```

Expected survivors (acceptable, historical):
- `infra/lxc/docs/SETUP.md` line 373 — fix this in Phase 12
- `pnpm-lock.yaml` — will be gone after `pnpm install`

After Phase 12, the only remaining `apps/web` references should be in `.planning/` (historical planning docs — intentional).

### Deliverable 7: Workspace installs clean

```bash
pnpm install --frozen-lockfile  # Will fail (lockfile out of date after deletion)
pnpm install                     # Regenerates lockfile
pnpm --filter dashboard build    # Dashboard still builds
pnpm --filter dashboard test     # Tests still pass
```

### Full reference audit checklist

| Location | Before Phase 12 | After Phase 12 |
|---|---|---|
| `apps/web/` directory | Exists | Deleted |
| `pnpm-lock.yaml` `apps/web:` stanza | Line 190 | Removed by `pnpm install` |
| `pnpm-workspace.yaml` | `apps/*` glob (no change needed) | Unchanged |
| `turbo.json` | No web entries | Unchanged |
| `.github/workflows/ci.yml` | No web references | Unchanged |
| `.github/workflows/test-config-manager.yml` | No web references | Unchanged |
| `Dockerfile` | No web references | Unchanged |
| `docker-compose.yml` | No web references | Unchanged |
| `README.md` | References `apps/web/` as docs site | Updated to describe dashboard |
| `infra/lxc/docs/SETUP.md:373` | Hardcoded `apps/web/content/docs/` link | Updated to `/docs/` URL or migrated path |

---

## Phase 12 Scope Summary

**Files to delete:** `apps/web/` (entire directory)

**Files requiring content changes:**
1. `README.md` — rewrite monorepo overview for dashboard-centric structure
2. `infra/lxc/docs/SETUP.md` line 373 — fix broken `apps/web` link

**Files auto-updated by tooling:**
1. `pnpm-lock.yaml` — regenerated by `pnpm install`

**Files confirmed unchanged:**
- `pnpm-workspace.yaml`
- `turbo.json`
- `.github/workflows/ci.yml`
- `.github/workflows/test-config-manager.yml`
- `Dockerfile`
- `docker-compose.yml`

**Total manual edits needed:** 2 files + deletion of 1 directory + 1 `pnpm install`

---

## RESEARCH COMPLETE
