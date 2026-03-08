# Phase 06: CI/CD & Deployment - Research

**Researched:** 2026-03-08
**Domain:** Docker deployment, GitHub Actions CI/CD, Next.js 16 standalone, BullMQ worker containerization, E2E testing
**Confidence:** HIGH

## Summary

Phase 06 ships production Docker deployment for the `apps/dashboard` Next.js 16 app and its BullMQ worker, plus an extended GitHub Actions CI/CD pipeline with unit tests and optional E2E coverage. The project already has a Dockerfile (targeting a non-existent `apps/web` workspace instead of `apps/dashboard`) and a skeletal `docker-compose.yml`. The existing `.github/workflows/ci.yml` runs lint, format, and build checks but has no test step.

The core work is: (1) fix and extend the Dockerfile to correctly target `apps/dashboard`, add standalone output mode, and containerize the BullMQ worker; (2) produce a production `docker-compose.yml` that wires the Next.js app, BullMQ worker, PostgreSQL, and Redis together with correct env vars and startup ordering; (3) extend GitHub Actions with a `test` job (vitest is already configured), and add a `docker-build` smoke job; (4) consider adding Playwright E2E — the ROADMAP goal says "E2E testing" but there is no Playwright setup in the repo yet, so this is the highest-risk open question.

The existing `apps/dashboard/docker-compose.dev.yml` already covers dev-time PostgreSQL and Redis. The production compose file needs to add the app and worker services while retaining data volume patterns from the dev file.

**Primary recommendation:** Fix the Dockerfile for `apps/dashboard` with `output: "standalone"` in `next.config.ts`, add a worker Dockerfile or multi-stage target, produce a `docker-compose.prod.yml` with all four services (postgres, redis, next, worker), extend CI with a `test` job, and add a basic Playwright smoke test on the `/login` route using GitHub Actions service containers for dependencies.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Docker multi-stage build | - | Build Next.js standalone + worker images | Minimizes final image size; separates build deps from runtime |
| `next` output: standalone | Next.js 16 built-in | Self-contained server.js for Docker | Eliminates need to copy all node_modules into runner image |
| `pnpm/action-setup@v4` | v4 | pnpm in GitHub Actions | Already used in ci.yml; the official action |
| `actions/checkout@v4` | v4 | Checkout in CI | Already used throughout ci.yml |
| `actions/setup-node@v4` | v4 | Node 22 in CI | Already used; matches Dockerfile base image |
| Vitest | ^4.0.18 | Unit tests | Already installed and configured |
| Playwright | ^1.x | E2E browser tests | De-facto standard for Next.js E2E; integrates with GitHub Actions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `docker/build-push-action@v6` | v6 | Build and push Docker images in CI | If publishing to a registry (ghcr.io) |
| `docker/login-action@v3` | v3 | Authenticate to container registry | Paired with build-push-action |
| `@playwright/test` | ^1.51 | E2E test runner + assertions | For smoke tests against running Next.js |
| postgres:16-alpine | Docker Hub | Test DB service container in CI | Already used in docker-compose.dev.yml |
| redis:7-alpine | Docker Hub | Test Redis service container in CI | Already used in docker-compose.dev.yml |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright E2E | Cypress | Playwright has better Next.js App Router support, faster CI startup, built-in trace viewer |
| Single Dockerfile | Separate Dockerfiles | Multi-stage in one file reduces maintenance; two files give cleaner separation for worker-only rebuilds |
| `docker-compose.prod.yml` | Kubernetes manifests | Docker Compose is simpler for a single-host Proxmox deployment; K8s adds unnecessary complexity |

**Installation (dashboard workspace):**
```bash
pnpm --filter dashboard add -D @playwright/test
npx playwright install --with-deps chromium
```

## Architecture Patterns

### Recommended Project Structure
```
/                                  # monorepo root
├── Dockerfile                     # fixed: targets apps/dashboard
├── Dockerfile.worker              # BullMQ worker (or second stage in Dockerfile)
├── docker-compose.yml             # production: next + worker + postgres + redis
├── apps/dashboard/
│   ├── next.config.ts             # add output: "standalone"
│   ├── e2e/                       # Playwright E2E tests
│   │   └── smoke.test.ts
│   ├── playwright.config.ts
│   └── ...
└── .github/workflows/
    ├── ci.yml                     # extended: add test + docker-build jobs
    └── test-config-manager.yml    # existing: shellcheck
```

### Pattern 1: Next.js Standalone Output for Docker

**What:** `output: "standalone"` in `next.config.ts` generates `.next/standalone/` — a self-contained Node.js server that includes only the required server files and a minimal `node_modules` copy. The runner image copies only this directory plus `.next/static` and `public/`.

**When to use:** Always for Docker deployments of Next.js apps. Without it, you must copy the entire `node_modules` (hundreds of MB) into the runner image.

**Critical gotcha for Turbopack monorepos:** The existing `next.config.ts` sets `turbopack.root` to the monorepo root. With standalone output, the generated standalone directory will be at `apps/dashboard/.next/standalone/` and the server entrypoint is `apps/dashboard/.next/standalone/apps/dashboard/server.js` (the monorepo path is preserved). The Dockerfile COPY paths must account for this.

**Example:**
```typescript
// apps/dashboard/next.config.ts
const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: monorepoRoot,
  },
};
```

### Pattern 2: Multi-Stage Dockerfile for Monorepo

**What:** Three stages — `deps` (install), `builder` (build), `runner` (minimal runtime). The existing Dockerfile has the right shape but targets `apps/web` (wrong workspace).

**Critical monorepo considerations for pnpm:**
- The `deps` stage must copy `pnpm-workspace.yaml` and ALL workspace `package.json` files before running `pnpm install --frozen-lockfile`, otherwise pnpm cannot resolve the workspace graph
- Prisma client generation happens automatically via `postinstall` hook (`prisma generate`), which requires `DATABASE_URL` to NOT be required at build time — use `?` in datasource url or set a placeholder
- The `COPY . .` in the builder stage must happen after deps to leverage Docker layer cache

**Example (corrected for apps/dashboard):**
```dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/dashboard/package.json apps/dashboard/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter dashboard build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
USER nextjs
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000
CMD ["node", "apps/dashboard/server.js"]
```

### Pattern 3: BullMQ Worker as Separate Process

**What:** The BullMQ worker (`src/workers/container-creation.ts`) runs as a long-lived Node.js process via `tsx`. It connects to the same Redis and PostgreSQL as the Next.js app but has no HTTP server. It should run as a separate container (or Docker Compose service) so it can be restarted independently.

**When to use:** Always — the worker must not share the Next.js process. The existing `dev:all` script demonstrates this separation.

**Worker container approach:** Two options:
1. Second stage in the same Dockerfile (simpler, shares build cache)
2. Separate `Dockerfile.worker` (cleaner separation, allows independent rebuilds)

Recommended: second `target` stage in the same Dockerfile — same base image, same deps, just different CMD.

**Example:**
```dockerfile
FROM base AS worker-runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY apps/dashboard/src/workers ./apps/dashboard/src/workers
COPY apps/dashboard/src/lib ./apps/dashboard/src/lib
# tsx is a devDependency — include it or use ts-node/esm
CMD ["node", "--import", "tsx/esm", "apps/dashboard/src/workers/container-creation.ts"]
```

Note: `tsx` is a devDependency. In production, options are: (a) pre-compile the worker to JS and run with `node`; (b) use `tsx` from devDependencies (acceptable for a self-hosted deployment); (c) ship source + tsx in the worker image. Simplest: compile worker to JS as part of `pnpm build` step.

### Pattern 4: Production docker-compose with Service Dependencies

**What:** The production `docker-compose.yml` must start postgres and redis before the app and worker, run Prisma migrations on startup, and expose only the Next.js port.

**Example structure:**
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: dashboard
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: dashboard
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dashboard"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]

  migrate:
    build: .
    command: ["pnpm", "--filter", "dashboard", "exec", "prisma", "migrate", "deploy"]
    environment:
      DATABASE_URL: postgresql://dashboard:${POSTGRES_PASSWORD}@postgres:5432/dashboard
    depends_on:
      postgres:
        condition: service_healthy

  app:
    build: .
    ports:
      - "${PORT:-3000}:3000"
    environment:
      DATABASE_URL: postgresql://dashboard:${POSTGRES_PASSWORD}@postgres:5432/dashboard
      REDIS_URL: redis://redis:6379
    depends_on:
      migrate:
        condition: service_completed_successfully
      redis:
        condition: service_healthy

  worker:
    build:
      context: .
      target: worker-runner
    environment:
      DATABASE_URL: postgresql://dashboard:${POSTGRES_PASSWORD}@postgres:5432/dashboard
      REDIS_URL: redis://redis:6379
    depends_on:
      migrate:
        condition: service_completed_successfully
      redis:
        condition: service_healthy

volumes:
  postgres-data:
  redis-data:
```

### Pattern 5: GitHub Actions with Service Containers for Unit Tests

**What:** GitHub Actions supports Docker service containers that run alongside the job. For the existing vitest tests that may need Redis/PG, declare them in the job's `services` block.

**Example:**
```yaml
test:
  name: Test
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16-alpine
      env:
        POSTGRES_USER: dashboard
        POSTGRES_PASSWORD: dashboard
        POSTGRES_DB: dashboard
      options: >-
        --health-cmd pg_isready
        --health-interval 5s
        --health-timeout 5s
        --health-retries 5
      ports:
        - 5432:5432
    redis:
      image: redis:7-alpine
      options: >-
        --health-cmd "redis-cli ping"
        --health-interval 5s
        --health-timeout 3s
        --health-retries 5
      ports:
        - 6379:6379
  env:
    DATABASE_URL: postgresql://dashboard:dashboard@localhost:5432/dashboard
    REDIS_URL: redis://localhost:6379
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "22"
        cache: "pnpm"
    - run: pnpm install --frozen-lockfile
    - run: pnpm --filter dashboard exec prisma migrate deploy
    - run: pnpm --filter dashboard test
```

### Pattern 6: Playwright E2E Smoke Test

**What:** A Playwright smoke test starts the Next.js app (or tests against a running Docker Compose stack) and verifies key routes load without JavaScript errors.

**When to use:** "E2E testing" is a stated goal of Phase 06. A minimal smoke test on `/login` and the dashboard route validates the full stack without requiring Proxmox mocks.

**Example:**
```typescript
// apps/dashboard/e2e/smoke.test.ts
import { test, expect } from "@playwright/test";

test("login page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator("body")).toBeVisible();
});
```

**playwright.config.ts:**
```typescript
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3002",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3002",
    reuseExistingServer: !process.env.CI,
  },
});
```

### Anti-Patterns to Avoid

- **Copying entire node_modules into runner image:** Use `output: "standalone"` to avoid this. Without it, the Docker image will be 1-2 GB.
- **Running Prisma migrations in the app container CMD:** Migrations and the app share a race condition on startup. Use a dedicated `migrate` service with `service_completed_successfully` condition.
- **Hardcoding DATABASE_URL with `localhost`:** In Docker networking, services communicate by container name, not `localhost`. The app must use `postgres:5432` not `localhost:5432`.
- **Not setting `NEXT_TELEMETRY_DISABLED=1`:** Next.js phones home during build; disabling it speeds up CI.
- **Missing `prisma generate` in Docker build:** The `postinstall` hook runs it via pnpm, but standalone builds sometimes skip postinstall. Ensure `prisma generate` runs explicitly in the builder stage or via `prebuild` hook (already configured in package.json).
- **tsx as prod dependency issue:** The worker uses `tsx` for TypeScript execution. In production Docker, `tsx` is a devDependency and won't be installed with `--production`. Either pre-compile the worker or install devDependencies in the worker image.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Healthcheck for postgres | Custom wait script | Docker Compose `healthcheck` + `depends_on: condition: service_healthy` | Race conditions on startup are subtle; Docker handles it correctly |
| Database migration on startup | Custom shell script in CMD | Dedicated `migrate` service with `service_completed_successfully` | Prevents running migrations while app is already serving traffic |
| Prisma client generation | Manual step | `postinstall` / `prebuild` hooks (already in package.json) | Already wired; just ensure it runs in Docker build layer |
| E2E auth flow mocking | Custom auth bypass | Playwright `storageState` or skip auth-gated routes | SIWE wallet auth is not testable in headless CI without a mock |
| Registry auth in CI | Manual docker login | `docker/login-action@v3` | Handles token rotation, multi-registry |

**Key insight:** The Docker and CI ecosystem for Next.js monorepos has well-known patterns. Every problem listed above has a standard solution that accounts for race conditions and edge cases that a hand-rolled approach will miss.

## Common Pitfalls

### Pitfall 1: Dockerfile targets wrong workspace (already broken)

**What goes wrong:** The existing `Dockerfile` copies `apps/web/package.json` and builds `pnpm --filter web build`. The actual dashboard app is `apps/dashboard`.
**Why it happens:** Dockerfile was created for a different app and never updated.
**How to avoid:** Change all `apps/web` references to `apps/dashboard` and `web` filter to `dashboard`.
**Warning signs:** `pnpm --filter web build` exits with "No packages matched the filter `web`."

### Pitfall 2: Standalone output path doesn't match Dockerfile COPY

**What goes wrong:** With `output: "standalone"`, Next.js generates `.next/standalone/` and the server is at `.next/standalone/apps/dashboard/server.js` (monorepo path preserved). The existing Dockerfile COPY pattern `COPY ... .next/standalone ./` + `CMD ["node", "apps/web/server.js"]` will fail.
**Why it happens:** Standalone output mirrors the workspace directory structure relative to the project root.
**How to avoid:** Test locally first with `next build` and inspect `.next/standalone/` to confirm the exact server.js path before writing the Dockerfile CMD.
**Warning signs:** `node apps/dashboard/server.js` → "Cannot find module" error at container start.

### Pitfall 3: Prisma generates to wrong path in Docker

**What goes wrong:** Prisma client is generated to `src/generated/prisma/client` (per schema.prisma `output` field). This path must exist in the runner image. With standalone output, Prisma's generated client may not be included automatically.
**Why it happens:** Standalone output traces only files imported by Next.js pages — Prisma client is often missed if tree-shaking eliminates the trace.
**How to avoid:** After building, check if `apps/dashboard/src/generated/prisma/client` exists in `.next/standalone/`. If not, add an explicit COPY in the Dockerfile. Alternatively, use `outputFileTracingIncludes` in next.config.ts to force inclusion.
**Warning signs:** `PrismaClientInitializationError` at runtime: cannot find `@prisma/client`.

### Pitfall 4: Worker tsx dependency not available in production image

**What goes wrong:** `tsx` is in `devDependencies`. A production Docker build with `pnpm install --prod` will omit it, causing the worker CMD to fail.
**Why it happens:** The worker uses TypeScript source directly at runtime via `tsx`.
**How to avoid:** Either (a) add a `build:worker` script that compiles the worker to JS and update the CMD to `node apps/dashboard/dist/workers/container-creation.js`; or (b) install all dependencies (including devDeps) in the worker image — acceptable for a private self-hosted tool.
**Warning signs:** Worker container exits immediately with "Cannot find package 'tsx'."

### Pitfall 5: E2E tests can't authenticate with SIWE/RainbowKit

**What goes wrong:** SIWE authentication requires wallet interaction (MetaMask/Universal Profile wallet). Playwright cannot sign a SIWE message without a real wallet in headless mode.
**Why it happens:** The auth flow involves cryptographic wallet signatures via RainbowKit.
**How to avoid:** E2E tests should only cover unauthenticated routes (login page loads, redirect behavior) OR use a test-mode bypass (e.g., a special env var that creates a pre-authenticated session). Do NOT attempt to simulate full wallet signing in CI.
**Warning signs:** Tests hang waiting for wallet popup that never appears.

### Pitfall 6: GitHub Actions pnpm cache misses on workspace package installs

**What goes wrong:** `actions/setup-node` caches based on the lockfile hash, but if workspace packages have separate `node_modules`, caching may be incomplete.
**Why it happens:** pnpm workspaces have per-package node_modules in some configurations.
**How to avoid:** Use `pnpm/action-setup@v4` (already used in ci.yml) which correctly sets up the pnpm store. The `cache: "pnpm"` option in `setup-node` caches the global store.
**Warning signs:** Every CI run re-downloads packages despite lockfile being unchanged.

### Pitfall 7: Prisma migrate deploy requires DATABASE_URL at CI time

**What goes wrong:** The test job must run `prisma migrate deploy` before tests, but DATABASE_URL must point to the CI service container.
**Why it happens:** Prisma reads DATABASE_URL from the environment.
**How to avoid:** Set `DATABASE_URL` as a job-level env var pointing to the `localhost:5432` service container (GitHub Actions maps service container ports to localhost for the runner).
**Warning signs:** Prisma: "Environment variable not found: DATABASE_URL" or connection refused.

## Code Examples

Verified patterns from official sources and existing project code:

### GitHub Actions: pnpm with caching (existing pattern, ci.yml)
```yaml
- uses: pnpm/action-setup@v4
- uses: actions/setup-node@v4
  with:
    node-version: "22"
    cache: "pnpm"
- run: pnpm install --frozen-lockfile
```

### GitHub Actions: service containers for postgres + redis
```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: dashboard
      POSTGRES_PASSWORD: dashboard
      POSTGRES_DB: dashboard
    options: >-
      --health-cmd pg_isready
      --health-interval 5s
      --health-timeout 5s
      --health-retries 5
    ports:
      - 5432:5432
  redis:
    image: redis:7-alpine
    options: >-
      --health-cmd "redis-cli ping"
      --health-interval 5s
      --health-timeout 3s
      --health-retries 5
    ports:
      - 6379:6379
```

### Next.js standalone output config
```typescript
// apps/dashboard/next.config.ts
const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: monorepoRoot,
  },
};
```

### Dockerfile: prisma generate in builder stage
```dockerfile
# After copying source, before building:
RUN pnpm --filter dashboard exec prisma generate
RUN pnpm --filter dashboard build
```

### Run vitest for dashboard workspace
```bash
pnpm --filter dashboard test
# or from apps/dashboard:
pnpm test
```

### Prisma migrate deploy in CI
```bash
pnpm --filter dashboard exec prisma migrate deploy
```

### Playwright config for local dev + CI
```typescript
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3002",
  },
  webServer: {
    command: "pnpm --filter dashboard dev",
    url: "http://localhost:3002",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Copy all node_modules to Docker runner | `output: "standalone"` traces only required files | Next.js 12+ | Image size: 2GB → ~300MB |
| `actions/cache` manual pnpm caching | `pnpm/action-setup@v4` + `cache: "pnpm"` in setup-node | 2023 | Simpler, more reliable cache |
| Cypress for E2E | Playwright | 2022+ | Faster, better Next.js App Router support, built-in trace viewer |
| `npm run` in CI | `pnpm --filter <workspace>` | pnpm workspaces era | Targets correct workspace without cd |

**Deprecated/outdated:**
- `apps/web` in Dockerfile: Wrong workspace name — never worked with this monorepo.
- `docker-compose.yml` current state: Only has `web` service with no postgres/redis — not functional for the dashboard app which needs both.
- `output: "export"` (static export): Not applicable — the app uses server actions, SSE, and API routes.

## Open Questions

1. **Scope of E2E testing**
   - What we know: ROADMAP says "E2E testing" is a goal; SIWE wallet auth is not testable headlessly
   - What's unclear: Should E2E cover only the login page redirect, or should it test the dashboard with a mock/test session?
   - Recommendation: Implement a minimal smoke test suite (3-5 tests) covering unauthenticated routes; add a `SKIP_AUTH=true` mode or test environment session bypass for authenticated routes if needed

2. **Docker image registry**
   - What we know: No registry is configured; deployment target appears to be self-hosted Proxmox
   - What's unclear: Should CI build and push to ghcr.io, or just validate the Docker build succeeds?
   - Recommendation: Start with a `docker build --no-push` validation job in CI; add push-to-registry step when a deployment target is confirmed

3. **Worker compilation strategy**
   - What we know: Worker uses `tsx` (devDependency) at runtime; `tsx` won't be available in a `--prod` install
   - What's unclear: Should the worker be pre-compiled to JS as part of the build, or should the worker image install devDeps?
   - Recommendation: Add a `build:worker` script (e.g., `tsx --tsconfig tsconfig.json src/workers/container-creation.ts` compiled to `dist/`) as part of the dashboard build pipeline, making the worker image fully production-safe

4. **Environment variable management for production**
   - What we know: `.env.example` shows 5 required env vars (`DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`, `SESSION_SECRET`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`)
   - What's unclear: How will secrets be injected in production (Docker secrets, `.env` file, host env)?
   - Recommendation: Document in a `docker-compose.prod.yml.example` with all required vars; do not include secret values in any committed files

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `apps/dashboard/vitest.config.ts` |
| Quick run command | `pnpm --filter dashboard test` |
| Full suite command | `pnpm --filter dashboard test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| — | Dockerfile builds without error | smoke | `docker build -t infrahaus-test .` | ❌ Wave 0 (new Dockerfile) |
| — | docker-compose.yml services start healthy | smoke | `docker compose up --wait` | ❌ Wave 0 (new compose) |
| — | CI pipeline: lint passes | automated | `pnpm lint` (existing) | ✅ |
| — | CI pipeline: format passes | automated | `pnpm format:check` (existing) | ✅ |
| — | CI pipeline: build passes | automated | `pnpm build` (existing) | ✅ |
| — | CI pipeline: unit tests pass | automated | `pnpm --filter dashboard test` | ✅ (vitest configured) |
| — | Login page loads (unauthenticated redirect) | E2E smoke | `pnpm --filter dashboard exec playwright test` | ❌ Wave 0 |
| — | Prisma migrations deploy cleanly | automated | `pnpm --filter dashboard exec prisma migrate deploy` | ✅ (migrations exist) |

### Sampling Rate
- **Per task commit:** `pnpm --filter dashboard test` (unit tests, ~5s)
- **Per wave merge:** `pnpm lint && pnpm --filter dashboard test`
- **Phase gate:** Full CI pipeline green (lint + format + build + test) before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/dashboard/e2e/smoke.test.ts` — Playwright smoke tests for unauthenticated routes
- [ ] `apps/dashboard/playwright.config.ts` — Playwright configuration pointing to port 3002
- [ ] Playwright install: `pnpm --filter dashboard add -D @playwright/test && npx playwright install --with-deps chromium`
- [ ] Updated `Dockerfile` — must exist before Docker smoke test can run
- [ ] Updated `docker-compose.yml` — must exist before compose healthcheck test

## Sources

### Primary (HIGH confidence)
- Official Next.js docs — `output: "standalone"`, monorepo Docker deployment, standalone file tracing
- Existing project files verified directly: `Dockerfile`, `docker-compose.yml`, `apps/dashboard/docker-compose.dev.yml`, `.github/workflows/ci.yml`, `apps/dashboard/vitest.config.ts`, `apps/dashboard/package.json`
- GitHub Actions official docs — service containers, pnpm/action-setup, setup-node cache

### Secondary (MEDIUM confidence)
- Playwright official docs — webServer config, headless CI setup, authentication handling
- pnpm workspaces Docker best practices — community-verified patterns for frozen-lockfile + workspace installs
- Prisma standalone output tracing issues — known behavior documented in Prisma GitHub issues (outputFileTracingIncludes workaround)

### Tertiary (LOW confidence)
- Worker tsx production compilation strategy — based on general TypeScript build patterns; specific approach needs validation in the project context

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools are already in use in the project or are the obvious standard for Next.js/pnpm
- Architecture: HIGH — Docker multi-stage + standalone output is well-documented and the existing Dockerfile shape is correct (just wrong target)
- Pitfalls: HIGH — Dockerfile wrong workspace, standalone path, Prisma generation are verified by reading existing files; SIWE E2E limitation is architectural fact
- E2E scope: LOW — the ROADMAP says "E2E testing" but no specifics; the right scope is a judgment call

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stable tooling — Docker, GitHub Actions, Playwright; Next.js standalone output pattern stable since v12)
