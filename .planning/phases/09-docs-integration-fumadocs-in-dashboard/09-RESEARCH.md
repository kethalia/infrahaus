# Phase 09: Research — Fumadocs in Dashboard

## Executive Summary

The existing `apps/web` app already uses Fumadocs (fumadocs-core ~15.8.5, fumadocs-ui ~15.8.5, fumadocs-mdx ~14.2.6) with a fully working configuration that can be lifted and adapted into `apps/dashboard`. The dashboard uses Next.js 16.1.6, React 19, Tailwind CSS v4, and `next-themes` for dark/light mode — all compatible with Fumadocs' current version. The primary integration challenge is that `apps/dashboard` uses a single `<html>` root layout without `RootProvider`, which Fumadocs requires for theming and search; this must be added at the right scope without breaking the existing authenticated dashboard shell.

---

## Current Dashboard Architecture

### App Router Structure

```
apps/dashboard/src/app/
├── (dashboard)/           # Route group — authenticated shell
│   ├── layout.tsx         # AppSidebar + SidebarInset + QueryProvider
│   ├── loading.tsx
│   ├── page.tsx           # / — container dashboard
│   ├── containers/
│   ├── templates/
│   └── settings/
├── api/                   # API routes
├── login/                 # Public — excluded from auth middleware
├── favicon.ico
├── globals.css            # Tailwind v4 + shadcn theme tokens (oklch)
└── layout.tsx             # Root layout — Geist fonts, <html>, <body>, Toaster
```

### Root Layout (apps/dashboard/src/app/layout.tsx)

The root layout is minimal: Geist fonts, `antialiased` body class, and `<Toaster>`. It does **not** include `suppressHydrationWarning` on `<html>` or any theme provider. `next-themes` is installed as a dependency (`^0.4.6`) but the `ThemeProvider` is not yet wired into the layout — dark/light mode is presumably driven by shadcn CSS variables without a JS toggle currently.

### Authentication Middleware

`src/middleware.ts` protects all routes except `/login`, `/_next/*`, and `/api/auth/*`. Any new `/docs` route will require session authentication by default. The planner must decide: **should `/docs` be public or auth-gated?** This is a key decision (see Key Decisions).

### Sidebar Component (apps/dashboard/src/components/app-sidebar.tsx)

- `"use client"` component
- Uses shadcn `Sidebar`, `SidebarContent`, `SidebarGroup`, `SidebarMenu`, `SidebarMenuButton` primitives
- `navItems` is a plain array of `{ title, href, icon }` objects
- Active state via `usePathname()`
- Currently has 4 nav items: Dashboard `/`, Templates `/templates`, Packages `/templates/packages`, Settings `/settings/nodes`
- A "Documentation" link (`/docs`) can be added by appending to `navItems` with a `BookOpen` or `FileText` lucide icon — straightforward change

### Theme System

- Tailwind v4 (CSS-first config, no `tailwind.config.ts`)
- `globals.css` uses `@import "tailwindcss"` + `@import "tw-animate-css"`
- CSS custom properties in `:root` and `.dark` using `oklch()` values
- Dark mode selector: `@custom-variant dark (&:is(.dark *))`  — the `.dark` class on `<html>` controls dark mode
- `next-themes` is already a dependency but not yet used in layout — the `<html>` element has no `class` or `suppressHydrationWarning`

### Next.js Config (next.config.ts)

- Output: `standalone`
- Turbopack `root` set to monorepo root (2 levels up from dashboard dir)
- No MDX plugin currently — `createMDX()` from `fumadocs-mdx/next` must be added
- Config uses `.ts` extension with `"type": "module"` in package.json — the Fumadocs `createMDX()` wrapping pattern works fine here

### TypeScript Config

- `@/*` paths map to `./src/*` (note: web maps to `./*` — different)
- Does **not** include the fumadocs-mdx path aliases yet:
  - `"fumadocs-mdx:collections/*": [".source/*"]` must be added
- Does **not** include `**/*.mdx` or `.source/**/*.ts` in `include` — both must be added

---

## Fumadocs Integration Pattern

### Package Versions to Install

Match versions from `apps/web` exactly to avoid drift:

```
fumadocs-core    ~15.8.5
fumadocs-ui      ~15.8.5
fumadocs-mdx     ~14.2.6
@types/mdx       ^2.0.13   (devDependency)
```

### Installation Command

```bash
pnpm --filter dashboard add fumadocs-core@~15.8.5 fumadocs-ui@~15.8.5 fumadocs-mdx@~14.2.6
pnpm --filter dashboard add -D @types/mdx@^2.0.13
```

### Route Group Pattern

Fumadocs docs routes should live in a dedicated route group to isolate the `DocsLayout` from the dashboard shell:

```
apps/dashboard/src/app/
├── (dashboard)/           # existing — dashboard shell with AppSidebar
├── (docs)/                # NEW — Fumadocs shell
│   └── docs/
│       ├── layout.tsx     # DocsLayout from fumadocs-ui
│       └── [[...slug]]/
│           └── page.tsx   # DocsPage with MDX rendering
└── api/
    └── search/
        └── route.ts       # NEW — Fumadocs search API
```

The `(docs)` route group has its own layout that renders the Fumadocs `DocsLayout`, completely independent of the `(dashboard)` layout (no `AppSidebar`, no `QueryProvider`). The URL is still `/docs/...`.

### Source Configuration (source.config.ts)

Place at the project root (same level as `next.config.ts`):

```ts
// apps/dashboard/source.config.ts
import { defineDocs, defineConfig } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs",
});

export default defineConfig();
```

Content will live at `apps/dashboard/content/docs/`.

### Source Loader (src/lib/source.ts)

```ts
// apps/dashboard/src/lib/source.ts
import { docs } from "@/.source/server";
import { loader } from "fumadocs-core/source";

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
```

Note: `@/.source/server` maps to `apps/dashboard/.source/server` — this is the auto-generated output from `fumadocs-mdx`. The `.source` dir is generated at build/dev time by the MDX plugin.

### MDX Components (src/mdx-components.tsx OR root mdx-components.tsx)

```tsx
// apps/dashboard/mdx-components.tsx  (at project root)
import type { MDXComponents } from "mdx/types";
import defaultMdxComponents from "fumadocs-ui/mdx";

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
  };
}
```

Next.js looks for `mdx-components.tsx` at the project root (alongside `package.json`), not inside `src/`. The web app correctly places this at root.

### Next.js Config Update

Wrap the existing config with `createMDX()`:

```ts
// apps/dashboard/next.config.ts
import { createMDX } from "fumadocs-mdx/next";

const monorepoRoot = process.cwd().split("/").slice(0, -2).join("/");

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/**": ["./src/generated/prisma/client/**/*"],
  },
  turbopack: {
    root: monorepoRoot,
  },
};

const withMDX = createMDX();
export default withMDX(nextConfig);
```

**Important:** The existing Turbopack `root` config must be preserved. Verify that `createMDX()` wrapper is compatible with the Turbopack root setting — this is a potential gotcha.

### Docs Layout (src/app/(docs)/docs/layout.tsx)

```tsx
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";
import type { ReactNode } from "react";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      nav={{ title: "Infrahaus Docs" }}
    >
      {children}
    </DocsLayout>
  );
}
```

### Docs Page (src/app/(docs)/docs/[[...slug]]/page.tsx)

Identical pattern to `apps/web` — copy and adapt with `@/` aliased to `./src/`.

### TypeScript Config Additions

Add to `apps/dashboard/tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "fumadocs-mdx:collections/*": [".source/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    "**/*.mdx",
    ".source/**/*.ts",
    ".next/types/**/*.ts"
  ]
}
```

---

## Content Structure

### Directory Location

```
apps/dashboard/
├── content/
│   └── docs/
│       ├── index.mdx          # /docs root
│       ├── meta.json          # top-level section ordering
│       ├── getting-started/
│       ├── container-templates/
│       ├── development/
│       ├── deployment/
│       ├── networking/
│       ├── blockchain/
│       ├── media/
│       ├── gaming/
│       └── ai/
└── source.config.ts
```

The 29 existing MDX files from `apps/web/content/docs/` are migrated in Phase 10, not Phase 09. Phase 09 only sets up the infrastructure with a minimal placeholder doc at `content/docs/index.mdx` to verify the route works.

### meta.json Pattern

Fumadocs uses `meta.json` files to control sidebar ordering. These are already present in `apps/web` and must be copied alongside MDX files during Phase 10.

---

## Theme Integration

### The Core Problem

Fumadocs requires `RootProvider` (from `fumadocs-ui/provider`) wrapped around the app to supply the theme context (dark/light toggle), search dialog, and sidebar state. In `apps/web`, this wraps the entire `<body>`. In the dashboard, this cannot wrap the entire app (it would conflict with the existing authenticated layout and `QueryProvider`).

### Solution: Scoped RootProvider

Add `RootProvider` only in the `(docs)` route group's layout, not the root layout:

```tsx
// apps/dashboard/src/app/(docs)/docs/layout.tsx
import { RootProvider } from "fumadocs-ui/provider";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider>
      <DocsLayout tree={source.getPageTree()} nav={{ title: "Infrahaus Docs" }}>
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
```

`RootProvider` wraps only the docs subtree. The existing dashboard routes are unaffected.

### CSS Import Strategy

The Fumadocs CSS imports (`fumadocs-ui/css/neutral.css` and `fumadocs-ui/css/preset.css`) should **not** be added to the global `globals.css` — that would inject Fumadocs styles into every page including the dashboard.

Instead, create a docs-specific CSS file:

```css
/* apps/dashboard/src/app/(docs)/docs.css */
@import "fumadocs-ui/css/neutral.css";
@import "fumadocs-ui/css/preset.css";
```

And import it only in the `(docs)` layout:

```tsx
import "./docs.css";
```

**Alternative approach:** Fumadocs neutral preset uses CSS variables that largely map to standard color names. If the dashboard's existing CSS variables (oklch-based) overlap with Fumadocs' expectations, there may be automatic compatibility. However, isolating the CSS imports is safer and avoids leakage.

### Dark Mode Compatibility

- Dashboard dark mode: `.dark` class on `<html>` (shadcn convention), driven by `@custom-variant dark (&:is(.dark *))`
- Fumadocs dark mode: also uses `.dark` class on `<html>` — same convention
- `next-themes` is already installed in dashboard but not yet wired up
- The root layout's `<html>` element must gain `suppressHydrationWarning` for `next-themes` to work without hydration warnings
- `RootProvider` from fumadocs-ui handles its own theme internally — but if the dashboard ever adds a global `ThemeProvider` (e.g., for a dark mode toggle in the sidebar), both must use the same `.dark` class target, which they do

**Decision needed:** Should the docs area have its own independent theme toggle (via `RootProvider`) or sync with a future dashboard-wide theme toggle? For Phase 09, the Fumadocs `RootProvider` handles it independently — this is fine for now.

---

## Search Setup

### Route Handler

```ts
// apps/dashboard/src/app/api/search/route.ts
import { source } from "@/lib/source";
import { createSearchAPI } from "fumadocs-core/search/server";

export const { GET } = createSearchAPI("advanced", {
  language: "english",
  indexes: source.getPages().map((page) => {
    const data = page.data as any;
    return {
      title: page.data.title ?? "",
      description: page.data.description,
      url: page.url,
      id: page.url,
      structuredData: data.structuredData ?? { headings: [], contents: [] },
    };
  }),
});
```

This is an exact copy from `apps/web/app/api/search/route.ts`. The path `@/lib/source` resolves to `src/lib/source.ts` in the dashboard's path config.

### Search UI

Fumadocs `DocsLayout` includes search UI automatically when `RootProvider` is present. No additional wiring needed beyond the route handler above.

### Auth Consideration for Search Route

The middleware currently protects all routes. The `/api/search` route must either:
1. Be excluded from middleware (add `pathname.startsWith("/api/search")` to the allowlist), OR
2. Accept that search only works for authenticated users (this is fine — docs are inside the dashboard, behind auth)

Option 2 is simpler and consistent with the decision to keep docs auth-gated.

---

## Sidebar Integration

### Adding Docs Link to AppSidebar

The `navItems` array in `apps/dashboard/src/components/app-sidebar.tsx` needs a new entry:

```ts
import { BookOpen } from "lucide-react";

const navItems = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "Templates", href: "/templates", icon: FileCode },
  { title: "Packages", href: "/templates/packages", icon: Package2 },
  { title: "Documentation", href: "/docs", icon: BookOpen },
  { title: "Settings", href: "/settings/nodes", icon: Settings },
];
```

### Active State for /docs/**

The current `isActive` check is `pathname === item.href` (exact match). For the docs link, this will only activate on `/docs` exactly, not on `/docs/getting-started` etc. Update the check:

```ts
const isActive =
  item.href === "/"
    ? pathname === "/"
    : pathname === item.href || pathname.startsWith(item.href + "/");
```

This handles the docs subtree correctly without affecting other nav items.

### Layout Relationship

The `(docs)` route group layout does **not** nest inside `(dashboard)` layout — they are siblings. Users navigating to `/docs` leave the dashboard shell (no `AppSidebar`) and enter the Fumadocs shell. The "Documentation" link in the dashboard sidebar takes them there; Fumadocs' own navigation (back button or breadcrumbs) brings them back if they navigate away.

This is the correct design — Fumadocs has its own sidebar (`DocsLayout`) that would conflict with the dashboard's `AppSidebar` if both rendered simultaneously.

---

## Monorepo Considerations

### Workspace Structure

```
pnpm-workspace.yaml:
  - apps/*
  - packages/*
```

No shared `packages/` directory exists. Fumadocs is installed directly as a dependency of `apps/dashboard` — no cross-workspace concerns.

### Turbopack Root Configuration

The dashboard's `next.config.ts` computes `monorepoRoot` via `process.cwd()` slicing and passes it to `turbopack.root`. The `createMDX()` wrapper from fumadocs-mdx wraps the Next.js config object — it should preserve the `turbopack` key. However, this must be verified during implementation; Turbopack and MDX plugins both touch the webpack/bundler config and conflicts are possible.

### `"type": "module"` in package.json

Dashboard `package.json` has `"type": "module"`. The `source.config.ts` and `next.config.ts` files use ESM syntax — this is correct and consistent with how `apps/web` is set up.

### `.gitignore` / Build Artifacts

The `.source/` directory is auto-generated by `fumadocs-mdx` at dev/build time. It should be added to `.gitignore` if not already present.

### pnpm Hoisting

Fumadocs packages may share peer dependencies (React, Next.js) that are already present in the dashboard. pnpm's strict hoisting should handle this correctly since both apps use the same React 19 / Next.js version range.

---

## Risk Areas

### 1. createMDX() + Turbopack Root Conflict

The `next.config.ts` already has a non-standard `turbopack.root` workaround for the monorepo CSS resolution. Wrapping with `createMDX()` may interfere. **Mitigation:** Test the dev server immediately after adding `createMDX()` and before writing any other code.

### 2. CSS Variable Name Collisions

`fumadocs-ui/css/preset.css` and `fumadocs-ui/css/neutral.css` define CSS custom properties on `:root`. The dashboard `globals.css` also defines extensive `:root` properties (shadcn). If the Fumadocs CSS is scoped only to the `(docs)` layout file, it loads only for docs pages — but CSS files in Next.js app layouts are global. This is a known Next.js behavior: CSS imported in a layout applies globally regardless of route.

**Mitigation strategies:**
- Use CSS `@layer` to lower Fumadocs specificity so shadcn variables win on dashboard pages
- OR use CSS custom property namespacing (Fumadocs uses `--fd-*` prefixed variables in newer versions — verify this)
- OR accept the override and verify dashboard pages still render correctly (the neutral theme is intentionally minimal)

### 3. `suppressHydrationWarning` Missing on `<html>`

Without `suppressHydrationWarning` on the root `<html>` element, `next-themes` / `RootProvider` will cause React hydration warnings when dark mode class is applied. Add this to the root layout's `<html>` tag.

### 4. Middleware Protecting /api/search

If the Fumadocs search dialog tries to fetch `/api/search` without credentials, it will get a redirect to `/login`. Since docs will be auth-gated anyway, this is consistent — but the search dialog's fetch must include credentials. Fumadocs' built-in search client sends `fetch` with default settings which should include cookies. Verify this works in practice.

### 5. `@types/mdx` Version

The dashboard's `tsconfig.json` does not include `**/*.mdx` in `include` and has no `@types/mdx`. Both must be added. If `@types/mdx` conflicts with any existing type declarations, it needs investigation.

### 6. next.config.ts Extension (TypeScript vs MJS)

`apps/web` uses `next.config.mjs`; the dashboard uses `next.config.ts`. The `createMDX()` import works in both formats. No issue expected, but worth noting the difference.

### 7. Version Skew Between Apps

`apps/web` uses Next.js `^15.3.3`; the dashboard uses Next.js `16.1.6`. Fumadocs 15.x is designed for Next.js 15 compatibility. Confirm Fumadocs 15.8.x works with Next.js 16 before proceeding. (Most likely yes — Next.js 16 is backward-compatible with app router patterns, but check fumadocs release notes.)

---

## Implementation Order

### Plan 09-01: Install Fumadocs + Configure source.config.ts + /docs Route Group

1. Add fumadocs-core, fumadocs-ui, fumadocs-mdx, @types/mdx to dashboard package.json
2. Run `pnpm install`
3. Create `apps/dashboard/source.config.ts`
4. Create `apps/dashboard/content/docs/index.mdx` (minimal placeholder)
5. Update `apps/dashboard/next.config.ts` with `createMDX()` wrapper
6. Update `apps/dashboard/tsconfig.json` — add MDX paths, `.source/**`, `**/*.mdx`
7. Create `apps/dashboard/src/lib/source.ts`
8. Create `apps/dashboard/mdx-components.tsx` (at project root)
9. Create route group: `src/app/(docs)/docs/[[...slug]]/page.tsx`
10. Verify `pnpm dev` starts without errors and `.source/` is generated

**Validation gate:** `GET http://localhost:3002/docs` renders the placeholder MDX page with `DocsPage` components visible.

### Plan 09-02: Fumadocs Layout (Sidebar, Breadcrumbs, Search, Theme Integration)

1. Create `src/app/(docs)/docs/layout.tsx` with `RootProvider` + `DocsLayout`
2. Create `src/app/(docs)/docs.css` with scoped Fumadocs CSS imports
3. Import `docs.css` in the docs layout
4. Add `suppressHydrationWarning` to root layout `<html>`
5. Create `src/app/api/search/route.ts` for full-text search
6. Verify dark/light toggle works on `/docs` pages
7. Verify search dialog opens and returns results
8. Verify breadcrumbs render correctly

**Validation gate:** `/docs` shows Fumadocs sidebar + breadcrumbs, theme toggle works, search returns results for content in placeholder doc.

### Plan 09-03: Dashboard Sidebar Integration + Navigation Unification

1. Add `BookOpen` import to `app-sidebar.tsx`
2. Add `{ title: "Documentation", href: "/docs", icon: BookOpen }` to `navItems`
3. Update `isActive` logic to use `startsWith` for non-root paths
4. Verify active state lights up for `/docs` and any sub-path
5. Verify clicking "Documentation" navigates to `/docs` and renders Fumadocs layout
6. Verify other nav items are unaffected

**Validation gate:** Dashboard sidebar shows Documentation link, clicking it renders docs, active state is correct on all nav items.

---

## Validation Architecture

### Deliverable → Verification Map

| Deliverable | Verification Method | Who Runs It |
|---|---|---|
| fumadocs-* installed in dashboard | `pnpm --filter dashboard list fumadocs-core` | Manual / CI build |
| source.config.ts configured | `.source/` directory generated after `pnpm dev` | Manual dev check |
| `/docs` route renders | HTTP GET `/docs` returns 200 with MDX content | E2E (Playwright) |
| Docs sidebar navigation works | Clicking sidebar link navigates correctly | E2E |
| Full-text search functional | Search dialog returns results for known term | E2E |
| Dark/light mode matches dashboard | Visual check + `.dark` class toggle | Manual visual review |
| Dashboard sidebar "Docs" link | Link present in DOM, `href="/docs"` | E2E |
| Active state for /docs/* | `isActive` class on Documentation link when on `/docs/any-page` | E2E |
| No JS errors on /docs | `page.on("pageerror")` listener in smoke test | E2E |
| Build succeeds | `pnpm --filter dashboard build` exits 0 | CI |

### Unit Tests

No new unit tests needed for this phase — the deliverables are infrastructure wiring, not business logic. Existing Vitest tests must continue to pass after the dependency changes.

### E2E Smoke Test Additions

Extend `apps/dashboard/e2e/smoke.test.ts` with a new describe block:

```ts
test.describe("Docs routing", () => {
  test("/docs redirects to /login when unauthenticated", async ({ page }) => {
    await page.goto("/docs");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/docs renders without JS errors when authenticated", async ({ page }) => {
    // Skip or use stored auth state if available
    // For CI smoke: verify the redirect behavior (auth cannot be tested headlessly)
    test.skip(true, "Requires authenticated session — tested manually");
  });
});
```

For authenticated validation (manual or future auth-capable tests):
- Navigate to `/docs` — expect `DocsPage` heading visible
- Click a sidebar link — expect URL changes and new content loads
- Open search (Cmd+K) — expect search dialog appears
- Type a search term — expect results appear
- Toggle theme — expect `dark` class added/removed from `<html>`
- Click "Documentation" in dashboard sidebar — expect `/docs` renders
- Navigate to `/docs/some-page` — expect Documentation link in sidebar has active class

### Build Verification

```bash
# After Phase 09-01 changes:
pnpm --filter dashboard build

# Check no TypeScript errors from MDX types:
pnpm --filter dashboard exec tsc --noEmit

# Check ESLint passes:
pnpm --filter dashboard lint
```

### Integration Check

After `pnpm dev` starts with the new config:
- Confirm `.source/` directory is generated at `apps/dashboard/.source/`
- Confirm `source.ts` can import from `@/.source/server` without errors
- Confirm no CSS bleed from Fumadocs onto dashboard pages (check dashboard `/` after adding docs CSS)

---

## Key Decisions for Planner

1. **Should `/docs` be public or auth-gated?**
   Current middleware gates everything. The simplest choice is to keep docs auth-gated (users must be logged in to read docs). If docs should be public, the middleware needs a `/docs` allowlist entry and the auth flow tested separately. Recommendation: keep auth-gated for Phase 09 to minimize scope.

2. **Where does RootProvider live — root layout or (docs) layout only?**
   Recommendation: scoped to `(docs)` layout only. This avoids any interference with existing dashboard behavior and keeps Fumadocs self-contained. A future phase can promote it if a global theme toggle is desired.

3. **Fumadocs CSS isolation strategy.**
   Recommendation: import Fumadocs CSS only in the `(docs)` layout file. Accept that Next.js CSS imports are globally scoped and verify no visual regression on dashboard pages. If regressions occur, use CSS `@layer` or wrapper class to scope.

4. **Fumadocs version — match apps/web exactly or use latest?**
   Recommendation: match `apps/web` exactly (`~15.8.5` / `~14.2.6`) to minimize unknowns. Upgrade both apps together in a later phase if needed.

5. **Content placeholder for Phase 09.**
   Phase 09 sets up infrastructure only — migration is Phase 10. A single `content/docs/index.mdx` is sufficient. The planner should specify minimum content to keep the route from 404-ing on the index page.

6. **`next.config.ts` extension vs `.mjs`.**
   Keep as `.ts` — do not change the extension. Verify `createMDX()` import works from a `.ts` config file with `"type": "module"` (it should, as both apps/web and dashboard use ESM).

7. **`@types/mdx` placement.**
   Should be a `devDependency` only (mirrors apps/web's setup).

---

## RESEARCH COMPLETE
