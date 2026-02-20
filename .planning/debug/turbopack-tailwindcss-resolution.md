---
status: fixing
trigger: "Error: Can't resolve 'tailwindcss' in '/home/coder/pve-home-lab/apps' when running pnpm dev:all"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:00:00Z
---

## Current Focus

hypothesis: Turbopack detects /home/coder as workspace root (due to /home/coder/pnpm-lock.yaml), causing CSS @import "tailwindcss" to resolve from /apps instead of /apps/dashboard where node_modules lives
test: Set turbopack.root in next.config.ts to the actual monorepo root (/home/coder/pve-home-lab)
expecting: Turbopack resolves tailwindcss from apps/dashboard/node_modules correctly
next_action: Apply fix to next.config.ts

## Symptoms

expected: pnpm dev:all starts Next.js dev server with Tailwind CSS working
actual: Error: Can't resolve 'tailwindcss' in '/home/coder/pve-home-lab/apps'
errors: "Can't resolve 'tailwindcss' in '/home/coder/pve-home-lab/apps'"
reproduction: run pnpm dev:all from apps/dashboard
started: only in dev (Turbopack); build works fine (Webpack)

## Eliminated

- hypothesis: tailwindcss not installed
  evidence: /home/coder/pve-home-lab/apps/dashboard/node_modules/tailwindcss EXISTS with dist/, index.css, etc.
  timestamp: 2026-02-17T00:00:00Z

- hypothesis: postcss config wrong
  evidence: postcss.config.mjs correctly uses @tailwindcss/postcss plugin
  timestamp: 2026-02-17T00:00:00Z

## Evidence

- timestamp: 2026-02-17T00:00:00Z
  checked: Turbopack root detection warning in dev output
  found: "We detected multiple lockfiles and selected /home/coder/pnpm-lock.yaml as root" — root set to /home/coder/
  implication: Turbopack resolves CSS @import "tailwindcss" starting from /home/coder/pve-home-lab/apps (wrong level, skips dashboard/node_modules)

- timestamp: 2026-02-17T00:00:00Z
  checked: globals.css
  found: @import "tailwindcss" — Tailwind v4 CSS import syntax, must be resolved as a module by Turbopack
  implication: Turbopack must walk node_modules from the CSS file's location up

- timestamp: 2026-02-17T00:00:00Z
  checked: node_modules resolution paths in error
  found: Checks /apps/node_modules, /pve-home-lab/node_modules, /home/coder/node_modules — NEVER checks /apps/dashboard/node_modules
  implication: Root miscalculation causes node_modules walk to start one level too high

- timestamp: 2026-02-17T00:00:00Z
  checked: build vs dev behavior
  found: build uses Webpack (no root issue), dev uses Turbopack (root detection bug)
  implication: This is a Turbopack-specific issue; fix must be in turbopack config

## Resolution

root_cause: /home/coder/pnpm-lock.yaml (unrelated monorepo) causes Turbopack to set workspace root to /home/coder/, making CSS @import "tailwindcss" resolve from /apps level instead of /apps/dashboard, skipping dashboard's node_modules
fix: Set turbopack.root in next.config.ts to the actual project monorepo root (/home/coder/pve-home-lab)
verification: pending
files_changed: [apps/dashboard/next.config.ts]
