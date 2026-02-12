# Technology Stack

**Analysis Date:** 2026-02-12

## Languages

**Primary:**

- TypeScript 5.x - All application code across both apps (`apps/dashboard/`, `apps/web/`)
- Bash - Infrastructure scripts in `infra/lxc/scripts/`, container provisioning templates

**Secondary:**

- SQL (PostgreSQL) - Database via Prisma migrations in `apps/dashboard/prisma/migrations/`
- MDX - Documentation content in `apps/web/content/docs/`

## Runtime

**Environment:**

- Node.js 22 (Alpine) - Specified in `Dockerfile` (`FROM node:22-alpine`)
- README states minimum Node.js 18+, but Docker and CI use Node.js 22

**Package Manager:**

- pnpm 10.28.2 - Specified in root `package.json` (`"packageManager": "pnpm@10.28.2"`)
- Lockfile: `pnpm-lock.yaml` present
- Workspace: `pnpm-workspace.yaml` defines `apps/*` and `packages/*`

## Frameworks

**Core:**

- Next.js 16.1.6 (`apps/dashboard/`) - Dashboard app with App Router, server actions, middleware
- Next.js 15.3.x (`apps/web/`) - Documentation site with Fumadocs MDX integration
- React 19.2.4 (`apps/dashboard/`) - UI layer with hooks, server components
- React 19.1.x (`apps/web/`) - Docs site UI

**Testing:**

- Vitest 4.x (`apps/dashboard/`) - Unit/integration test runner, config at `apps/dashboard/vitest.config.ts`
- Bats (Bash Automated Testing System) - Shell script tests in `infra/lxc/tests/`
- kcov - Bash code coverage for config-manager scripts

**Build/Dev:**

- Turborepo 2.8.x - Monorepo task orchestration, config at `turbo.json`
- PostCSS + `@tailwindcss/postcss` - CSS processing in both apps
- tsx 4.x - TypeScript execution for worker process and Prisma seed (`pnpm dev:worker`)
- concurrently 9.x - Runs Next.js dev server + BullMQ worker in parallel (`pnpm dev:all`)

**Linting/Formatting:**

- ESLint 9.x - Per-app configs at `apps/dashboard/eslint.config.mjs`, `apps/web/eslint.config.mjs`
- eslint-config-next 16.1.6 - Next.js-specific lint rules (core-web-vitals + typescript)
- eslint-config-prettier 10.x - Disables ESLint formatting rules that conflict with Prettier
- Prettier 3.8.x - Root config at `.prettierrc` (semi, double quotes, 2-space tabs, trailing commas)
- ShellCheck - Bash script linting in CI (`infra/lxc/` scripts)

## Key Dependencies

**Critical (dashboard app):**

- `@prisma/client` 7.3.0 + `@prisma/adapter-pg` 7.3.0 - ORM with PostgreSQL adapter via `pg` driver
- `bullmq` 5.67.2 - Job queue for async container creation (backed by Redis)
- `ioredis` 5.9.2 - Redis client for BullMQ, sessions, Pub/Sub, distributed locks
- `iron-session` 8.x - Encrypted cookie sessions (session ID stored in cookie, data in Redis)
- `next-safe-action` 8.x - Type-safe server actions with Zod validation
- `ssh2` 1.17.0 - SSH client for remote command execution on Proxmox hosts and containers
- `undici` 7.x - HTTP client for Proxmox VE API (bypasses Next.js fetch patching)
- `zod` 4.3.x - Runtime schema validation for API responses, form inputs, server actions

**UI (dashboard app):**

- `@radix-ui/*` (alert-dialog, dropdown-menu, label, select, slot) - Headless UI primitives
- `radix-ui` 1.4.3 - Additional Radix components
- `class-variance-authority` 0.7.x - Component variant system (shadcn/ui pattern)
- `clsx` 2.x + `tailwind-merge` 3.x - Conditional className composition
- `lucide-react` 0.563.x - Icon library
- `react-hook-form` 7.x + `@hookform/resolvers` 5.x - Form management with Zod resolver
- `sonner` 2.x - Toast notifications
- `next-themes` 0.4.x - Dark/light theme switching
- Tailwind CSS 4.x + `tw-animate-css` 1.4.x - Utility CSS with animations

**Docs site (web app):**

- `fumadocs-core` ~15.8.5 + `fumadocs-ui` ~15.8.5 + `fumadocs-mdx` ~14.2.6 - Documentation framework

**Infrastructure:**

- `pg` 8.18.0 - PostgreSQL client (used by Prisma adapter)
- `server-only` 0.0.1 - Build-time guard preventing server modules in client bundles

## Configuration

**Environment:**

- No `.env` file committed (listed in `.gitignore`)
- Required env vars for dashboard:
  - `DATABASE_URL` - PostgreSQL connection string (used by Prisma and `pg` Pool)
  - `REDIS_URL` - Redis connection string (BullMQ, sessions, Pub/Sub, locks)
  - `PVE_HOST` - Proxmox VE host IP/hostname
  - `PVE_ROOT_PASSWORD` - Root password for Proxmox VE SSH and API auth
  - `ENCRYPTION_KEY` - 64-char hex string for AES-256-GCM encryption of secrets
  - `SESSION_SECRET` - Required in production for iron-session cookie encryption (32+ chars)
- Optional env vars:
  - `PVE_PORT` - Proxmox API port (default: 8006)
  - `CONFIG_REPO_URL` - Git repo URL for config-manager sync
  - `TEMPLATES_ROOT` - Filesystem path to template discovery root (default: `../../infra/lxc/templates`)
  - `PORT` - Application port (default: 3000 for web, 3001 for dashboard)

**Build:**

- `turbo.json` - Task pipeline: `build` depends on `^build`, outputs `.next/**`; `dev` is non-cached + persistent; `lint` depends on `^lint`
- `apps/dashboard/next.config.ts` - Default Next.js config (no special options)
- `apps/web/next.config.mjs` - `output: "standalone"`, `reactStrictMode: true`, Fumadocs MDX integration via `createMDX()`
- `apps/dashboard/tsconfig.json` - `strict: true`, target ES2017, `@/*` path alias to `./src/*`
- `apps/dashboard/prisma.config.ts` - Schema at `prisma/schema.prisma`, migrations at `prisma/migrations/`

**TypeScript:**

- Module resolution: `bundler`
- Strict mode enabled
- Path alias: `@/*` → `./src/*` (dashboard app)
- JSX: `react-jsx`

## Platform Requirements

**Development:**

- Node.js 22.x (matches CI and Docker)
- pnpm 10.28.2 (corepack-managed)
- PostgreSQL instance (for Prisma)
- Redis instance (for BullMQ, sessions, Pub/Sub)
- Access to a Proxmox VE host (for live container operations)

**Production:**

- Docker deployment via multi-stage `Dockerfile` (Node.js 22 Alpine)
- `docker-compose.yml` exposes port 3000 (web app only currently)
- Next.js standalone output mode for minimal production image
- PostgreSQL + Redis required as external services

**CI/CD:**

- GitHub Actions (`.github/workflows/ci.yml`)
  - Lint → Format check → Build pipeline
  - Node.js 22, pnpm with cache
  - Runs on push/PR to `main`
- GitHub Actions (`.github/workflows/test-config-manager.yml`)
  - ShellCheck lint → Unit tests (bats in Docker) → Coverage (kcov) → Integration tests (Docker with systemd)
  - Path-filtered: only runs on `infra/lxc/**` changes

---

_Stack analysis: 2026-02-12_
