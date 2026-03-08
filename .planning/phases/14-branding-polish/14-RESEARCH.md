---
phase: 14
title: Branding + Polish
status: research-complete
date: 2026-03-08
---

# Phase 14 Research — Branding + Polish

## Objective

Unify "Infrahaus" branding throughout the monorepo. Replace all remnants of the old "LXC Manager" / "LXC Template Manager Dashboard" product names with "Infrahaus". Final polish before v2.0 ships.

---

## 1. Current State Analysis

### 1.1 Old Branding Strings Still Present (Production Code)

| File | Line | Current Value | Target Value |
|------|------|---------------|--------------|
| `apps/dashboard/src/app/layout.tsx` | 17 | `"LXC Template Manager Dashboard"` | `"Infrahaus"` |
| `apps/dashboard/src/app/layout.tsx` | 18 | `"Manage and deploy LXC containers on Proxmox VE"` | `"Self-hosted infrastructure management dashboard"` (or similar) |
| `apps/dashboard/src/components/app-sidebar.tsx` | 85 | `<span className="font-semibold">LXC Manager</span>` | `<span className="font-semibold">Infrahaus</span>` |
| `apps/dashboard/src/components/app-sidebar.tsx` | 86 | `<span className="text-xs">Dashboard</span>` | keep as `"Dashboard"` or change to `"v2.0"` — decision needed |
| `apps/dashboard/src/app/login/page.tsx` | 71 | `<CardTitle className="text-2xl">LXC Manager</CardTitle>` | `<CardTitle className="text-2xl">Infrahaus</CardTitle>` |
| `apps/dashboard/src/lib/web3/config.ts` | 28 | `appName: "LXC Manager"` | `appName: "Infrahaus"` |
| `apps/dashboard/src/components/providers/web3-provider.tsx` | 33 | `"Sign in to LXC Manager with your Universal Profile."` | `"Sign in to Infrahaus with your Universal Profile."` |
| `apps/dashboard/package.json` | 2 | `"name": "dashboard"` | `"name": "@infrahaus/dashboard"` |
| `apps/dashboard/README.md` | 3 | `LXC Template Manager Dashboard for Proxmox VE.` | `Infrahaus — self-hosted infrastructure management dashboard.` |

### 1.2 Root README Status

`/README.md` — Already titled "Infrahaus" (line 1: `# Infrahaus`). The content is already updated and accurate. **No changes needed to root README.**

### 1.3 Docs Content Status

`apps/dashboard/content/docs/index.mdx` — Already uses `title: Infrahaus` and `# Infrahaus` heading. **No changes needed.**

Other MDX content files use "Dashboard" contextually (e.g., "Go to [Templates](/templates) in the dashboard"), which is appropriate descriptive language, not a product name. **No changes needed to MDX content files.**

### 1.4 Docs Layout Title

`apps/dashboard/src/app/(docs)/docs/layout.tsx` — Already set to `nav={{ title: "Infrahaus Docs" }}`. **Already correct.**

### 1.5 Favicon

Current favicon: `apps/dashboard/src/app/favicon.ico` — A standard MS Windows icon (4 icons: 16x16 and 32x32, 32bpp, 25.9 KB). This appears to be the **Next.js default favicon** — a plain placeholder, not custom Infrahaus branding.

Next.js App Router resolves favicon from `app/favicon.ico` automatically. To update: replace this file with a custom Infrahaus favicon.

**No public/ directory exists** — `apps/dashboard/public/` does not exist. This is consistent with App Router favicon placement inside `src/app/`.

### 1.6 Package Name Downstream Impact

Current: `"name": "dashboard"` in `apps/dashboard/package.json`

This name is referenced in:
- `pnpm --filter dashboard` commands in:
  - `Dockerfile` (lines 29–30)
  - `docker-compose.yml` (line 34)
  - `.github/workflows/ci.yml` (lines 109, 112, 169, 172, 175, 181)
  - `README.md` (line 43)
  - `apps/dashboard/playwright.config.ts` (line 30)

**Critical gotcha:** If `package.json` name is changed to `@infrahaus/dashboard`, ALL `--filter dashboard` commands will break unless updated to `--filter @infrahaus/dashboard`.

pnpm filter syntax supports both short names and scoped names. With name `@infrahaus/dashboard`, the filter can be either:
- `pnpm --filter @infrahaus/dashboard ...` (full scoped name)
- `pnpm --filter dashboard ...` (pnpm supports partial name matching for scoped packages — `dashboard` would still match `@infrahaus/dashboard`)

**Verified behavior:** pnpm's `--filter` uses glob matching. A filter of `dashboard` will match `@infrahaus/dashboard` because the unscoped portion matches. This means existing `--filter dashboard` commands **do not need to change**. However, for clarity and correctness, they should be updated to use `--filter @infrahaus/dashboard`.

---

## 2. Files Affected Across the Monorepo

### 2.1 Production Code Changes (Required)

| File | Change |
|------|--------|
| `apps/dashboard/src/app/layout.tsx` | Update `title` and `description` metadata |
| `apps/dashboard/src/components/app-sidebar.tsx` | Update sidebar header brand name |
| `apps/dashboard/src/app/login/page.tsx` | Update CardTitle |
| `apps/dashboard/src/lib/web3/config.ts` | Update `appName` |
| `apps/dashboard/src/components/providers/web3-provider.tsx` | Update SIWE statement |
| `apps/dashboard/package.json` | Rename `"name"` field |
| `apps/dashboard/src/app/favicon.ico` | Replace with Infrahaus favicon |

### 2.2 Infrastructure/Config Changes (Required for consistency)

| File | Change |
|------|--------|
| `Dockerfile` | Update `--filter dashboard` → `--filter @infrahaus/dashboard` |
| `docker-compose.yml` | Update `--filter dashboard` → `--filter @infrahaus/dashboard` |
| `.github/workflows/ci.yml` | Update all `--filter dashboard` → `--filter @infrahaus/dashboard` |
| `apps/dashboard/playwright.config.ts` | Update `--filter dashboard` → `--filter @infrahaus/dashboard` |
| `README.md` | Update `pnpm --filter dashboard dev` → `pnpm --filter @infrahaus/dashboard dev` |

### 2.3 App-internal README

| File | Change |
|------|--------|
| `apps/dashboard/README.md` | Update first line from "LXC Template Manager Dashboard" to "Infrahaus" |

### 2.4 No Changes Needed

- `/README.md` — Already says "Infrahaus" ✅
- `apps/dashboard/content/docs/**` — MDX content already uses "Infrahaus" ✅
- `apps/dashboard/src/app/(docs)/docs/layout.tsx` — Already says "Infrahaus Docs" ✅
- `.planning/**` — Historical planning docs; do not modify ✅
- `turbo.json` — No package name references ✅
- `pnpm-workspace.yaml` — Uses glob `"apps/*"`, not package names ✅

---

## 3. Technical Approach for Each Deliverable

### 3.1 Dashboard Title / Metadata

**File:** `apps/dashboard/src/app/layout.tsx`

Change `metadata` object:
```ts
export const metadata: Metadata = {
  title: "Infrahaus",
  description: "Self-hosted infrastructure management on Proxmox VE",
};
```

The `title` can also use the Next.js template pattern for per-page titles:
```ts
export const metadata: Metadata = {
  title: {
    default: "Infrahaus",
    template: "%s | Infrahaus",
  },
  description: "Self-hosted infrastructure management on Proxmox VE",
};
```
The template approach is more polished — pages like "Containers | Infrahaus" appear in browser tabs. This is a decision for the plan author.

### 3.2 Sidebar Brand Name

**File:** `apps/dashboard/src/components/app-sidebar.tsx`

Two text nodes in the sidebar header currently say "LXC Manager" and "Dashboard":
```tsx
<span className="font-semibold">LXC Manager</span>
<span className="text-xs">Dashboard</span>
```

Target:
```tsx
<span className="font-semibold">Infrahaus</span>
<span className="text-xs">Dashboard</span>
```

The sub-label "Dashboard" is a reasonable descriptor and can stay. Alternatively "v2.0" is another option — plan author should decide.

### 3.3 Login Page Title

**File:** `apps/dashboard/src/app/login/page.tsx`

Change `CardTitle` from `"LXC Manager"` to `"Infrahaus"`.

### 3.4 Web3 / RainbowKit App Name

**File:** `apps/dashboard/src/lib/web3/config.ts`

```ts
appName: "Infrahaus",
```

**File:** `apps/dashboard/src/components/providers/web3-provider.tsx`

```ts
statement: "Sign in to Infrahaus with your Universal Profile.",
```

Note: The `appName` in RainbowKit config is used in the WalletConnect modal. The `statement` appears in the SIWE (Sign-In with Ethereum) message that users sign in their wallet. Both should be updated together for consistency.

### 3.5 Package Name

**File:** `apps/dashboard/package.json`

Change `"name": "dashboard"` to `"name": "@infrahaus/dashboard"`.

This change has downstream effects on all `--filter dashboard` commands (see Section 2.2). The safe approach:
- pnpm partial matching means existing `--filter dashboard` commands still work after renaming, but update them anyway for clarity.
- The Dockerfile, docker-compose, CI, playwright config, and README all use `--filter dashboard` and should be updated to `--filter @infrahaus/dashboard`.

### 3.6 Favicon

**File:** `apps/dashboard/src/app/favicon.ico`

Next.js App Router automatically serves `src/app/favicon.ico` as `/favicon.ico`. Replacing this file updates the browser tab icon and bookmarks.

**Options:**
1. Create a simple text/monogram favicon (e.g., "IH" or an SVG icon converted to ICO)
2. Use an emoji favicon via metadata: `icons: { icon: "data:image/svg+xml,<svg...>" }` — no file replacement needed
3. Replace the ICO file with a custom PNG/SVG that Next.js converts automatically

Next.js App Router also supports `icon.png`, `icon.svg`, `apple-icon.png` in the app directory as special file conventions that automatically generate `<link>` tags. An `icon.svg` file alongside `favicon.ico` gives better quality on modern browsers.

**Simplest approach for this phase:** Replace `favicon.ico` with a custom Infrahaus-branded one. If a custom design isn't available, a square with "IH" initials works as a placeholder. A designer-generated favicon is ideal.

### 3.7 apps/dashboard README

**File:** `apps/dashboard/README.md`

Simple one-line change:
```
# Dashboard

LXC Template Manager Dashboard for Proxmox VE.
```
→
```
# Infrahaus — Dashboard

Self-hosted infrastructure management on Proxmox VE.
```

---

## 4. Gotchas

### 4.1 Package Name Change and `--filter` Commands

When renaming `package.json` `"name"` from `"dashboard"` to `"@infrahaus/dashboard"`:
- pnpm's partial filter matching means `--filter dashboard` still resolves to `@infrahaus/dashboard`. So nothing breaks functionally.
- However, it's confusing to have `--filter dashboard` when the package is now `@infrahaus/dashboard`. Update all occurrences for clarity and correctness.
- Affected files: `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml`, `apps/dashboard/playwright.config.ts`, `README.md`

### 4.2 Web3 SIWE Statement

The SIWE statement (`"Sign in to LXC Manager with your Universal Profile."`) is embedded in the cryptographic message that users sign with their wallet. Changing it only affects **new sign-in sessions** — existing sessions are not invalidated. Users who sign in after the change will sign the new message. This is safe to change.

### 4.3 RainbowKit `appName`

The `appName: "LXC Manager"` in `lib/web3/config.ts` shows up in the WalletConnect pairing UI and in the WalletConnect Cloud dashboard (if a project ID is configured). Changing it to `"Infrahaus"` changes what users see in their wallet app's connection list. This is cosmetic and safe to change.

### 4.4 Favicon File Format

Next.js accepts `.ico`, `.png`, `.svg` for the `favicon.ico`/`icon.*` file conventions. For maximum browser compatibility, an `.ico` file with 16x16 and 32x32 sizes is best. If replacing with a PNG, name it `icon.png` instead of `favicon.ico` (App Router will handle it correctly via the metadata file convention). Either approach works.

### 4.5 Docs Layout `nav.title` Already Correct

`apps/dashboard/src/app/(docs)/docs/layout.tsx` already has `nav={{ title: "Infrahaus Docs" }}`. Do not change this.

### 4.6 Historical Planning Docs

Files in `.planning/` reference "LXC Template Manager" extensively (historical context). Do not modify these — they are historical records.

---

## 5. Validation Architecture

After implementing Phase 14, verify completeness using the following checks:

### 5.1 Automated String Checks

Run these grep commands to confirm old branding is gone from production code:

```bash
# Must return 0 results (excluding .next/, node_modules/, .planning/)
grep -rn "LXC Manager\|LXC Template Manager" \
  apps/dashboard/src/ apps/dashboard/README.md README.md \
  Dockerfile docker-compose.yml .github/

# Must return the new value
grep -n '"name"' apps/dashboard/package.json
# Expected: "name": "@infrahaus/dashboard"

grep -n '"title"' apps/dashboard/src/app/layout.tsx
# Expected: title: "Infrahaus" (or template variant)
```

### 5.2 Visual Checks

| Check | Where | Expected |
|-------|-------|----------|
| Browser tab title | Any dashboard page | "Infrahaus" (or "PageName \| Infrahaus") |
| Favicon in tab | Any page | Custom Infrahaus icon (not Next.js default) |
| Sidebar header | Authenticated dashboard | "Infrahaus" as primary label |
| Login page heading | `/login` | "Infrahaus" |
| Docs nav title | `/docs` | "Infrahaus Docs" |

### 5.3 Build Verification

```bash
# TypeScript check (no OOM — uses tsc only)
cd apps/dashboard && npx tsc --noEmit

# Full build (skip type-check worker due to pre-existing OOM constraint)
NEXT_SKIP_TYPE_CHECK=1 pnpm --filter @infrahaus/dashboard build
```

### 5.4 pnpm Filter Check

```bash
# Verify the renamed package is still resolvable
pnpm --filter @infrahaus/dashboard exec node -e "console.log('filter works')"
```

### 5.5 Favicon Check

```bash
# Verify favicon.ico exists and is not the default Next.js file
ls -la apps/dashboard/src/app/favicon.ico
file apps/dashboard/src/app/favicon.ico
```

---

## Summary of All Files to Change

| File | Type | Change Summary |
|------|------|----------------|
| `apps/dashboard/src/app/layout.tsx` | Source | title/description metadata |
| `apps/dashboard/src/components/app-sidebar.tsx` | Source | sidebar brand name |
| `apps/dashboard/src/app/login/page.tsx` | Source | login card title |
| `apps/dashboard/src/lib/web3/config.ts` | Source | RainbowKit appName |
| `apps/dashboard/src/components/providers/web3-provider.tsx` | Source | SIWE statement |
| `apps/dashboard/package.json` | Config | package name |
| `apps/dashboard/src/app/favicon.ico` | Asset | replace with Infrahaus favicon |
| `apps/dashboard/README.md` | Docs | app-level README title |
| `Dockerfile` | Config | --filter dashboard → @infrahaus/dashboard |
| `docker-compose.yml` | Config | --filter dashboard → @infrahaus/dashboard |
| `.github/workflows/ci.yml` | CI | all --filter dashboard references |
| `apps/dashboard/playwright.config.ts` | Config | --filter dashboard → @infrahaus/dashboard |
| `README.md` | Docs | --filter dashboard → @infrahaus/dashboard in Quick Start |

**Total files: 13** (8 source/config, 2 docs, 3 infra/CI)
