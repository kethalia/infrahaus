# External Integrations

**Analysis Date:** 2026-02-12

## APIs & External Services

**Proxmox VE REST API:**

- Primary external API - manages LXC containers, nodes, storage, tasks
- SDK/Client: Custom `ProxmoxClient` class at `apps/dashboard/src/lib/proxmox/client.ts`
- HTTP library: `undici` (used instead of global fetch to bypass Next.js fetch patching for TLS config)
- Base URL pattern: `https://{host}:{port}/api2/json`
- Auth methods supported:
  - Ticket-based: `POST /access/ticket` with username/password → cookie + CSRF token (2h TTL)
  - API token: `PVEAPIToken={tokenId}={tokenSecret}` header (for DB-stored node credentials)
- SSL: Self-signed certs accepted by default (`rejectUnauthorized: false` via undici Agent)
- Retry: Built-in exponential backoff (3 retries, 1s initial, 10s max) for 5xx and network errors
- Auth env vars: `PVE_HOST`, `PVE_PORT` (default 8006), `PVE_ROOT_PASSWORD`
- Ticket caching: In-memory with 5-minute expiry buffer (`apps/dashboard/src/lib/proxmox/index.ts`)

**Proxmox API Modules:**

- `apps/dashboard/src/lib/proxmox/auth.ts` - Login, ticket refresh
- `apps/dashboard/src/lib/proxmox/containers.ts` - CRUD + lifecycle (start/stop/shutdown/delete)
- `apps/dashboard/src/lib/proxmox/nodes.ts` - Cluster node listing, node status
- `apps/dashboard/src/lib/proxmox/storage.ts` - Storage pool listing, content browsing
- `apps/dashboard/src/lib/proxmox/templates.ts` - OS template listing from storage
- `apps/dashboard/src/lib/proxmox/tasks.ts` - Async task polling (UPID-based)
- `apps/dashboard/src/lib/proxmox/schemas.ts` - Zod schemas for all API responses
- `apps/dashboard/src/lib/proxmox/types.ts` - TypeScript types inferred from Zod schemas
- `apps/dashboard/src/lib/proxmox/errors.ts` - Custom error classes (ProxmoxError, ProxmoxApiError, ProxmoxAuthError)

## Data Storage

**Databases:**

- PostgreSQL (primary data store)
  - Connection: `DATABASE_URL` env var
  - Client: Prisma ORM 7.3.0 with `@prisma/adapter-pg` (driver adapter using `pg` Pool)
  - Schema: `apps/dashboard/prisma/schema.prisma`
  - Generated client output: `apps/dashboard/src/generated/prisma/client/`
  - Data access layer: `apps/dashboard/src/lib/db.ts` (`DatabaseService` static class)
  - Connection pooling: `pg` Pool with global singleton pattern (hot-reload safe)
  - Migrations: `apps/dashboard/prisma/migrations/` (3 migrations as of analysis date)
  - Models: `ProxmoxNode`, `Template`, `TemplateScript`, `TemplateFile`, `Package`, `PackageBucket`, `Container`, `ContainerService`, `ContainerEvent`
  - Seed: `apps/dashboard/prisma/seed.ts` (run via `tsx`)

- Redis (caching, queues, sessions, pub/sub)
  - Connection: `REDIS_URL` env var
  - Client: `ioredis` 5.9.2 with lazy connect, auto-retry
  - Singleton: `apps/dashboard/src/lib/redis.ts` (`getRedis()`)
  - Uses:
    1. **BullMQ job queue** - Container creation pipeline (`container-creation` queue)
    2. **Session storage** - User session data stored with `session:{id}` key prefix, 7200s TTL
    3. **Pub/Sub** - Real-time container creation progress events (`container:{id}:progress` channels)
    4. **Distributed locks** - Container lifecycle locks (`container-lock:{id}` prefix, 300s TTL) via `apps/dashboard/src/lib/utils/redis-lock.ts`
  - Worker uses separate Redis connections (BullMQ requires `maxRetriesPerRequest: null`)

**File Storage:**

- Local filesystem only
  - LXC templates discovered from `infra/lxc/templates/` directory
  - Template discovery engine: `apps/dashboard/src/lib/templates/discovery.ts`
  - Template parser: `apps/dashboard/src/lib/templates/parser.ts`
  - Configurable via `TEMPLATES_ROOT` env var (default: `../../infra/lxc/templates`)

**Caching:**

- Redis (see above) for session data and job queue state
- In-memory Proxmox ticket cache in `apps/dashboard/src/lib/proxmox/index.ts` (5-minute buffer)
- No dedicated HTTP caching layer

## Authentication & Identity

**Auth Provider:**

- Custom env-var based (single-user mode)
  - Implementation: `PVE_HOST` + `PVE_ROOT_PASSWORD` env vars authenticate against Proxmox API
  - Auth middleware: `apps/dashboard/src/lib/safe-action.ts` (`authActionClient` validates env vars are set)
  - Route middleware: `apps/dashboard/src/middleware.ts` (redirects `/login` to `/` since no login needed)
  - Login/logout actions are no-ops: `apps/dashboard/src/lib/auth/actions.ts`

- Session infrastructure exists but is dormant (ready for future multi-user):
  - `iron-session` for encrypted cookie containing session ID
  - Redis-backed session data storage
  - Session management: `apps/dashboard/src/lib/session.ts`
  - Cookie name: `lxc-session`
  - Session TTL: 7200 seconds (2 hours, matches Proxmox ticket lifetime)

- DB-stored node credentials (for API token auth):
  - `ProxmoxNode.tokenSecret` encrypted via AES-256-GCM
  - Encryption: `apps/dashboard/src/lib/encryption.ts` (`encrypt()`/`decrypt()`)
  - Key: `ENCRYPTION_KEY` env var (64-char hex = 32 bytes)
  - Factory: `createProxmoxClientFromNode()` in `apps/dashboard/src/lib/proxmox/index.ts`

## SSH Connectivity

**SSH Client:**

- `ssh2` library used for remote command execution
- Implementation: `apps/dashboard/src/lib/ssh.ts`
- Two session types:
  1. `SSHSession` - Direct SSH to a host (exec, streaming exec, SFTP upload)
  2. `PctExecSession` - Routes commands through Proxmox host via `pct exec`/`pct push` (avoids needing SSH in containers)
- Connection retry: `connectWithRetry()` with exponential backoff (5 attempts, 2s initial)
- Used by:
  - Container creation worker (`apps/dashboard/src/workers/container-creation.ts`) - provisioning pipeline
  - Container monitoring (`apps/dashboard/src/lib/containers/monitoring.ts`) - service/port/credential discovery

## Background Processing

**Job Queue (BullMQ):**

- Queue name: `container-creation`
- Queue definition: `apps/dashboard/src/lib/queue/container-creation.ts`
- Worker: `apps/dashboard/src/workers/container-creation.ts` (standalone process via `tsx`)
- Concurrency: 2 simultaneous container creation jobs
- No auto-retry (container creation is not idempotent, `attempts: 1`)
- Job retention: 100 completed, 500 failed
- Run command: `pnpm dev:worker` or `pnpm dev:all` (concurrent with Next.js)

**Progress Reporting:**

- Redis Pub/Sub for real-time events (`container:{containerId}:progress` channel)
- SSE endpoint: `apps/dashboard/src/app/api/containers/[id]/progress/route.ts`
- Events persisted to `ContainerEvent` table for late subscribers and audit
- Heartbeat: 15s interval on SSE connections
- Event types: `step`, `log`, `complete`, `error`

## Monitoring & Observability

**Error Tracking:**

- None (console.error logging only)

**Logs:**

- `console.log` / `console.error` throughout
- Worker outputs structured job completion/failure banners
- Config-manager logs to `/var/log/config-manager/sync.log` inside containers

## CI/CD & Deployment

**Hosting:**

- Self-hosted via Docker (multi-stage Dockerfile)
- Docker image: Node.js 22 Alpine, Next.js standalone output
- `docker-compose.yml` for web app service (port 3000)
- No cloud hosting configured

**CI Pipeline:**

- GitHub Actions
- `.github/workflows/ci.yml` - Lint, format check, build (Node.js apps)
- `.github/workflows/test-config-manager.yml` - ShellCheck, bats unit tests, kcov coverage, Docker integration tests (bash scripts)
- Runs on: push to `main`, PRs targeting `main`

## Environment Configuration

**Required env vars (dashboard):**

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `PVE_HOST` - Proxmox VE host address
- `PVE_ROOT_PASSWORD` - Proxmox root password
- `ENCRYPTION_KEY` - 64-char hex string for AES-256-GCM

**Required in production:**

- `SESSION_SECRET` - 32+ char string for iron-session cookie encryption

**Optional env vars:**

- `PVE_PORT` - Proxmox API port (default: 8006)
- `CONFIG_REPO_URL` - Git repo for config-manager sync
- `TEMPLATES_ROOT` - Path to LXC template definitions
- `PORT` - App port (default: 3000)
- `NODE_ENV` - `production` / `development`
- `NEXT_TELEMETRY_DISABLED` - Set to `1` in Docker

**Secrets location:**

- `.env` and `.env.local` files (gitignored)
- Container secrets (tokenSecret, rootPassword) encrypted in PostgreSQL via AES-256-GCM
- Session data stored in Redis with TTL

## Webhooks & Callbacks

**Incoming:**

- None detected

**Outgoing:**

- None detected

## Real-Time Communication

**Server-Sent Events (SSE):**

- `apps/dashboard/src/app/api/containers/[id]/progress/route.ts`
- Purpose: Stream container creation progress to the browser
- Flow: Worker publishes to Redis Pub/Sub → SSE route subscribes → streams to client
- Client hook: `apps/dashboard/src/hooks/use-container-progress.ts`
- Features: Snapshot replay for late subscribers, heartbeat keepalive, automatic cleanup

**Redis Pub/Sub Channels:**

- `container:{containerId}:progress` - Container creation progress events
- Used for decoupled communication between BullMQ worker process and Next.js API route

---

_Integration audit: 2026-02-12_
