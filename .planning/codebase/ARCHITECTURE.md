# Architecture

**Analysis Date:** 2026-02-12

## Pattern Overview

**Overall:** Monorepo with two independent Next.js apps + infrastructure-as-code configs, orchestrated by Turborepo.

**Key Characteristics:**

- **Two-app monorepo:** `apps/dashboard` (Proxmox management) and `apps/web` (documentation site) share the pnpm workspace but are architecturally independent
- **Server-centric Next.js App Router:** Dashboard uses React Server Components for data fetching, Server Actions for mutations, and API routes for SSE streaming
- **Background job processing:** Container creation offloaded to a standalone BullMQ worker process communicating via Redis Pub/Sub
- **Dual data merge pattern:** Dashboard pages merge PostgreSQL records with live Proxmox API data at request time
- **Infrastructure-as-code repository:** `infra/` contains Docker Compose stacks, shell scripts, and Terraform templates for various home lab services

## Layers

**Presentation Layer (React Components):**

- Purpose: UI rendering, client-side interactivity, form handling
- Location: `apps/dashboard/src/components/`
- Contains: React components (tsx), client-side hooks
- Depends on: UI primitives (`components/ui/`), Zod schemas (`lib/*/schemas.ts`), Server Actions (via `useAction()`)
- Used by: Page components in `apps/dashboard/src/app/`

**Page Layer (Next.js App Router):**

- Purpose: Route handling, server-side data fetching, layout composition
- Location: `apps/dashboard/src/app/(dashboard)/`
- Contains: `page.tsx` (RSC data fetching), `layout.tsx` (shell), `loading.tsx` (suspense)
- Depends on: Data layer (`lib/containers/data.ts`), components
- Used by: Next.js router

**API Routes:**

- Purpose: SSE streaming (progress events) and REST endpoints for client polling
- Location: `apps/dashboard/src/app/api/`
- Contains: Route handlers (`route.ts`)
- Depends on: Redis Pub/Sub, `DatabaseService`, `encryption`
- Used by: Client-side `EventSource` (progress hook), fetch calls

**Server Actions Layer:**

- Purpose: Authenticated mutations (create, start, stop, delete containers; template CRUD; package management)
- Location: `apps/dashboard/src/lib/*/actions.ts`
- Contains: `"use server"` functions using `authActionClient.schema().action()` pattern
- Depends on: `safe-action.ts`, `DatabaseService`, `ProxmoxClient`, `BullMQ queue`, `encryption`
- Used by: Client components via `useAction()` from `next-safe-action/hooks`

**Data Layer:**

- Purpose: Server-only data fetching with Proxmox/DB merge logic
- Location: `apps/dashboard/src/lib/containers/data.ts`
- Contains: `getContainersWithStatus()`, `getContainerDetailData()` — fetches DB + Proxmox in parallel, merges
- Depends on: `DatabaseService`, `ProxmoxClient`
- Used by: RSC page components

**Database Service Layer:**

- Purpose: All Prisma operations centralized in a single static class
- Location: `apps/dashboard/src/lib/db.ts`
- Contains: `DatabaseService` (static methods), type exports, Prisma instance
- Depends on: Prisma Client, PostgreSQL (via `pg` driver adapter)
- Used by: Server Actions, Data Layer, Worker, API routes

**Proxmox Client Layer:**

- Purpose: HTTP client for Proxmox VE API with auth, retry, and Zod validation
- Location: `apps/dashboard/src/lib/proxmox/`
- Contains: `ProxmoxClient` class, domain modules (`containers.ts`, `nodes.ts`, `tasks.ts`, `storage.ts`, `templates.ts`), Zod schemas, error hierarchy
- Depends on: `undici` for HTTP, `zod` for response validation
- Used by: Server Actions, Data Layer, Worker

**Queue Layer:**

- Purpose: Job definition, queue management, progress event types
- Location: `apps/dashboard/src/lib/queue/container-creation.ts`
- Contains: `ContainerJobData`, `ContainerProgressEvent`, `getContainerCreationQueue()`
- Depends on: `bullmq`, `ioredis`
- Used by: Server Actions (enqueue), Worker (dequeue), SSE route (progress channel)

**Worker Layer:**

- Purpose: Standalone BullMQ worker executing the 5-phase container creation pipeline
- Location: `apps/dashboard/src/workers/container-creation.ts`
- Contains: Pipeline logic (create → start → deploy → sync → finalize), Redis Pub/Sub publishing
- Depends on: All infrastructure libs (Proxmox, DB, SSH, encryption), runs outside Next.js via `tsx`
- Used by: BullMQ (job processing)

**SSH Layer:**

- Purpose: Remote command execution on Proxmox host and containers
- Location: `apps/dashboard/src/lib/ssh.ts`
- Contains: `SSHSession` (direct SSH), `PctExecSession` (pct exec/push via host SSH), `connectWithRetry()`
- Depends on: `ssh2` library
- Used by: Worker (container setup), Monitoring engine

**Monitoring Layer:**

- Purpose: SSH-based service discovery, port scanning, credential reading, config-manager status
- Location: `apps/dashboard/src/lib/containers/monitoring.ts`
- Contains: `monitorContainer()`, `checkSystemdServices()`, `discoverPorts()`, `readCredentials()`
- Depends on: SSH layer
- Used by: `refreshContainerServicesAction` server action

**Infrastructure Layer (non-app):**

- Purpose: Docker Compose stacks, shell scripts, Terraform templates for home lab services
- Location: `infra/`
- Contains: Per-service directories with `docker-compose.yaml`, setup scripts, config files
- Depends on: External Docker images, Proxmox host
- Used by: Manual deployment, template discovery engine

## Data Flow

**Container Dashboard Page Load:**

1. RSC `page.tsx` calls `getContainersWithStatus()` in `lib/containers/data.ts`
2. Data layer fetches DB containers + counts via `DatabaseService` (PostgreSQL)
3. Data layer fetches live status from Proxmox API for all online cluster nodes
4. `mergeContainerStatus()` combines DB lifecycle with Proxmox live status per container
5. Returns `DashboardData` with `ContainerWithStatus[]` to RSC for rendering

**Container Creation Flow:**

1. Client form submits via `useAction(createContainerAction)` from `next-safe-action/hooks`
2. Server Action validates input (Zod), creates DB record, encrypts password, enqueues BullMQ job
3. Client redirects to `/containers/{id}/progress` page
4. Progress page connects to SSE endpoint `/api/containers/{id}/progress`
5. SSE route replays persisted events as snapshot, subscribes to Redis Pub/Sub
6. Worker picks up job from BullMQ queue, executes 5-phase pipeline:
   - Phase 1 (0-20%): Create LXC via Proxmox API
   - Phase 2 (20-35%): Start container via Proxmox API
   - Phase 3 (35-60%): Deploy config-manager + template files via SSH (pct exec)
   - Phase 4 (60-90%): Install packages + run template scripts via SSH
   - Phase 5 (90-100%): Discover services/credentials + finalize
7. Worker publishes `ContainerProgressEvent` to Redis Pub/Sub at each step
8. SSE route forwards events to client in real-time
9. Worker updates container lifecycle to `ready` or `error` in DB

**Container Lifecycle Action (start/stop/restart/delete):**

1. Client calls `useAction(startContainerAction)` etc.
2. Server Action acquires Redis distributed lock (`acquireLock()`)
3. Fetches container context (DB record + Proxmox client)
4. Validates current state, performs Proxmox API operation
5. Waits for Proxmox task completion (`waitForTask()`)
6. Creates audit event in DB, revalidates paths
7. Releases Redis lock in `finally` block

**Template Discovery:**

1. Admin triggers `discoverTemplatesAction` server action
2. Discovery engine scans `infra/lxc/templates/` directory on filesystem
3. Parser reads `container.sh`, scripts, files, packages from each template
4. Upserts templates into PostgreSQL via Prisma transactions

**State Management:**

- Server state: PostgreSQL (containers, templates, packages, events, services, nodes)
- Session state: Redis (iron-session cookie → Redis session data with Proxmox ticket)
- Real-time state: Redis Pub/Sub (container creation progress events)
- Job queue: Redis via BullMQ (container creation jobs)
- Client state: React `useState`/`useRef` in hooks, `useForm` for forms, `EventSource` for SSE

## Key Abstractions

**`DatabaseService` (Static Service Class):**

- Purpose: Centralized data access for all Prisma operations
- File: `apps/dashboard/src/lib/db.ts`
- Pattern: Static methods, no instantiation needed, single Prisma instance with connection pooling
- Contains all CRUD for: ProxmoxNode, Template, PackageBucket, Package, Container, ContainerEvent, ContainerService

**`ProxmoxClient` (HTTP Client Class):**

- Purpose: Authenticated HTTP client for Proxmox VE REST API
- File: `apps/dashboard/src/lib/proxmox/client.ts`
- Pattern: Instance per request, supports ticket and API token auth, exponential backoff retry, Zod schema validation on responses
- Factory functions: `getProxmoxClient()` (env-based, cached ticket), `createProxmoxClientFromNode()` (DB-stored token)

**`authActionClient` (next-safe-action Client):**

- Purpose: Authenticated server action factory with error handling
- File: `apps/dashboard/src/lib/safe-action.ts`
- Pattern: `authActionClient.schema(zodSchema).action(async ({ parsedInput }) => {...})`
- Provides: Zod input validation, error classification (`ActionError` for user-facing, generic for unexpected), env-var auth check

**`SSHSession` / `PctExecSession` (SSH Wrappers):**

- Purpose: Execute commands on remote hosts or inside containers
- File: `apps/dashboard/src/lib/ssh.ts`
- Pattern: `SSHSession` wraps ssh2 Client for direct SSH; `PctExecSession` wraps `pct exec`/`pct push` via Proxmox host SSH for container access without in-container SSH

**`ContainerProgressEvent` (Progress Protocol):**

- Purpose: Typed events for real-time container creation progress
- File: `apps/dashboard/src/lib/queue/container-creation.ts`
- Pattern: Worker publishes events to Redis Pub/Sub → SSE route subscribes and forwards to browser EventSource
- Types: `step` (phase transitions with percent), `log` (streaming output), `complete`, `error`

## Entry Points

**Dashboard App (Next.js):**

- Location: `apps/dashboard/src/app/`
- Triggers: HTTP requests (port 3001)
- Responsibilities: Dashboard pages, API routes, server actions, middleware

**Container Creation Worker:**

- Location: `apps/dashboard/src/workers/container-creation.ts`
- Triggers: `pnpm dev:worker` (runs via `tsx --watch`)
- Responsibilities: BullMQ job processing, 5-phase container creation pipeline

**Documentation Site (Next.js):**

- Location: `apps/web/app/`
- Triggers: HTTP requests (port 3000)
- Responsibilities: Fumadocs documentation site with MDX content

**Concurrent Dev Mode:**

- Command: `pnpm dev:all` (in `apps/dashboard/`)
- Runs: Next.js dev server + Worker process via `concurrently`

## Error Handling

**Strategy:** Layered error handling with user-facing and internal error separation.

**Patterns:**

- **`ActionError`** (`lib/safe-action.ts`): Thrown in server actions for user-facing error messages. Message passed through to client.
- **`ProxmoxError` hierarchy** (`lib/proxmox/errors.ts`): `ProxmoxError` → `ProxmoxApiError` (HTTP errors) → `ProxmoxAuthError` (401). Includes status code, API path, and response body.
- **Network error detection** (`lib/utils/errors.ts`): `isNetworkError()` classifies connection failures → returns "Unable to reach Proxmox server" to user.
- **Worker errors**: Caught in try/catch, lifecycle set to `error`, error event published to Redis Pub/Sub and persisted to DB.
- **SSH errors**: Monitoring engine returns graceful error result (`MonitoringResult.error`) instead of throwing.
- **Redis locks**: Prevent concurrent lifecycle operations on same container. Lock failures return user-facing "Another operation in progress" message.

## Cross-Cutting Concerns

**Logging:** `console.log`/`console.error` throughout. No structured logging framework. Worker logs to stdout with formatted banners on completion/failure.

**Validation:** Zod schemas for all API inputs (server actions, Proxmox responses). Schemas shared between server and client for form validation (`zodResolver`). Shell argument validation via `isSafeShellArg()`.

**Authentication:** Currently env-var based (`PVE_HOST` + `PVE_ROOT_PASSWORD`). `authActionClient` middleware validates env vars are set. Session infrastructure (iron-session + Redis) exists but is bypassed — middleware redirects `/login` to dashboard. Multi-user DB-stored credentials planned but not implemented.

**Encryption:** AES-256-GCM via `lib/encryption.ts` for passwords and credentials stored in PostgreSQL. Key from `ENCRYPTION_KEY` env var (64-char hex).

**Distributed Locking:** Redis-based locks (`lib/utils/redis-lock.ts`) prevent concurrent container lifecycle operations.

---

_Architecture analysis: 2026-02-12_
