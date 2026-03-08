---
phase: 06-ci-cd-deployment
plan: 01
subsystem: infra
tags: [docker, dockerfile, nextjs, standalone, bullmq, pnpm, prisma]

requires:
  - phase: 05-web-ui-monitoring
    provides: Complete dashboard app ready for containerization

provides:
  - Fixed Dockerfile targeting apps/dashboard (was broken apps/web)
  - output: standalone enabled in next.config.ts for minimal runner image
  - outputFileTracingIncludes for Prisma client bundling
  - worker-runner Dockerfile stage for BullMQ container-creation worker
  - 5-stage multi-stage build: base, deps, builder, runner, worker-runner

affects: [06-02, 06-03, deployment]

tech-stack:
  added: []
  patterns:
    - Multi-stage Docker build with separate app runner and worker stages
    - Standalone Next.js output for minimal production images
    - tsx runtime for TypeScript worker without pre-compilation

key-files:
  created: []
  modified:
    - Dockerfile
    - apps/dashboard/next.config.ts

key-decisions:
  - "runner CMD targets apps/dashboard/server.js (monorepo standalone output path)"
  - "worker-runner copies only src/workers/ and src/lib/ — not entire src/"
  - "DATABASE_URL placeholder set in builder stage so prisma generate succeeds"
  - "tsx is a devDependency used at runtime in worker-runner (not pre-compiled)"
  - "outputFileTracingIncludes ensures Prisma client is bundled into standalone output"

patterns-established:
  - "Monorepo standalone: Next.js standalone output mirrors workspace structure (apps/dashboard/server.js)"
  - "Belt-and-suspenders Prisma: explicit prisma generate in builder despite postinstall hook"
---

# 06-01: Fix Dockerfile + Standalone Output

## What Was Built

Fixed the broken Dockerfile (was targeting non-existent `apps/web`) to properly build the `apps/dashboard` Next.js app and BullMQ worker.

## Changes

**`Dockerfile`** — Full rewrite, 5 stages:
- `base`: node:22-alpine with pnpm@10.28.2
- `deps`: Installs all dependencies (postinstall runs prisma generate)
- `builder`: Explicit prisma generate + `pnpm --filter dashboard build`
- `runner`: Minimal alpine image, copies standalone output, CMD `apps/dashboard/server.js`
- `worker-runner`: Runs `container-creation.ts` via `node --import tsx/esm`

**`apps/dashboard/next.config.ts`** — Added:
- `output: "standalone"` — enables minimal standalone bundle
- `outputFileTracingIncludes` for `./src/generated/prisma/client/**/*` — ensures Prisma client is bundled

## Verification

- Zero `apps/web` references in Dockerfile ✓
- 5 stages present ✓
- runner CMD: `["node", "apps/dashboard/server.js"]` ✓
- worker-runner CMD: `["node", "--import", "tsx/esm", "...container-creation.ts"]` ✓
- standalone + outputFileTracingIncludes in next.config.ts ✓
