---
phase: 06-ci-cd-deployment
plan: 03
subsystem: testing
tags: [github-actions, ci, playwright, vitest, e2e, docker]

requires:
  - phase: 06-01
    provides: Working Dockerfile for docker-build smoke job
  - phase: 06-02
    provides: Production compose (context for CI decisions)

provides:
  - Extended CI workflow with 6 jobs (lint, format, build, test, docker-build, e2e)
  - test job: vitest unit tests with postgres + redis service containers
  - docker-build job: Docker image smoke test
  - e2e job: Playwright chromium smoke tests
  - playwright.config.ts for apps/dashboard
  - e2e/smoke.test.ts with 3 unauthenticated route tests

affects: [deployment, future phases]

tech-stack:
  added:
    - "@playwright/test ^1.58.2"
  patterns:
    - Parallel CI: test runs alongside build (both need lint+format)
    - docker-build and e2e run in parallel after build
    - Smoke tests restricted to unauthenticated routes (SIWE cannot be tested headlessly)
    - webServer config: local dev uses Next.js dev server, CI starts server manually

key-files:
  created:
    - apps/dashboard/playwright.config.ts
    - apps/dashboard/e2e/smoke.test.ts
  modified:
    - .github/workflows/ci.yml
    - apps/dashboard/package.json

key-decisions:
  - "test job runs parallel with build (both need lint+format) for faster feedback"
  - "docker-build and e2e run parallel after build (both need [build])"
  - "Playwright smoke tests ONLY cover unauthenticated routes — SIWE wallet signing cannot be headlessly tested"
  - "e2e job starts dev server manually (pnpm dev &) then wait-on — not webServer config (CI=true disables it)"
  - "playwright.config.ts webServer: undefined when CI=true — CI manages server lifecycle"

patterns-established:
  - "CI parallelism: quality gates first, then build+test in parallel, then docker+e2e in parallel"
  - "Playwright baseURL: port 3002 (matches dashboard dev port)"
  - "Smoke test scope: redirect + render + UI element — no auth simulation"
---

# 06-03: CI Jobs + Playwright E2E

## What Was Built

Extended the GitHub Actions CI from 3 jobs to 6 jobs. Added Playwright E2E infrastructure.

## CI Pipeline

```
lint ─┬─→ build ─┬─→ docker-build
      │          └─→ e2e
format─┘
      └─→ test
```

**New jobs:**

| Job | Needs | What it does |
|-----|-------|-------------|
| test | [lint, format] | vitest with postgres+redis service containers |
| docker-build | [build] | `docker build -t infrahaus-test .` smoke test |
| e2e | [build] | Playwright chromium smoke tests |

## Playwright Smoke Tests

3 tests in `e2e/smoke.test.ts`:
1. **Root redirect** — `GET /` → URL matches `/login`
2. **Login renders** — `/login` loads without JS errors, body visible
3. **Connect button exists** — `/login` has at least one `role=button`

All tests are unauthenticated — SIWE wallet signing cannot be headlessly tested in CI.

## Changes

**`.github/workflows/ci.yml`** — Added 3 jobs:
- `test`: postgres+redis services, prisma migrate deploy, vitest
- `docker-build`: docker build smoke test
- `e2e`: playwright install, prisma migrate, dev server, wait-on, playwright test

**`apps/dashboard/playwright.config.ts`** — Created:
- testDir: ./e2e, port 3002, chromium only
- webServer: local dev only (disabled in CI via `process.env.CI`)

**`apps/dashboard/e2e/smoke.test.ts`** — Created: 3 smoke tests

**`apps/dashboard/package.json`** — Added:
- `"test:e2e": "playwright test"` script
- `"@playwright/test": "^1.58.2"` devDependency

## Verification

- 6 jobs in ci.yml ✓
- test job has postgres+redis service containers ✓
- docker-build runs `docker build -t infrahaus-test .` ✓
- e2e job runs `pnpm --filter dashboard test:e2e` ✓
- playwright.config.ts exists with correct port + testDir ✓
- smoke.test.ts has 3 tests, none touching authenticated routes ✓
- @playwright/test in devDependencies ✓
- test:e2e script in package.json ✓
