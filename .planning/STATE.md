# Project State

## Current Position

**Project:** LXC Template Manager Dashboard (apps/dashboard)
**Phase:** 03.5-infrastructure-refactor — In progress
**Plan:** 5 of 8 in current phase
**Status:** In progress — Container actions & data layer migrated to DB-based Proxmox auth
**Last activity:** 2026-02-20 — Completed 03.5-04-PLAN.md

Progress: ██████████░░░░░░░ 65% (28/43 plans)

## Completed Work

### Phase 1: Foundation (Issues #72-75) ✓

- Next.js 15 app with App Router, TypeScript, shadcn/ui, Tailwind v4
- Prisma schema with all models, Prisma client with pg adapter
- ProxmoxClient with retry logic, SSL handling, Zod validation
- iron-session v8 + Redis SSO auth, login page, route protection middleware

### Phase 2: Template System ✓

- Template discovery, browser, detail, creator/editor pages
- DatabaseService.createTemplate/updateTemplate with atomic transactions
- Package bucket CRUD with bulk operations

### Phase 3: Container Creation ✓

- BullMQ Worker with 5-phase pipeline
- 5-step creation wizard with progress tracking via SSE
- OS template selector, service/credential discovery

### Phase 4: Container Management ✓

**04-01 — Lifecycle actions + DB queries + client helper** ✓
**04-02 — Service monitoring engine** ✓
**04-03 — Container dashboard page** ✓
**04-04 — Container detail page** ✓
**04-05 — UAT navigation and loading fixes** ✓
**04-06 — UAT gap closure: Schema fixes and error logging** ✓
**04-07 — UAT gap closure: Prisma Client regeneration** ✓
**04-08 — UAT gap closure: Database migration for hostname column** ✓
**04-09 — UAT gap closure: DHCP container service refresh** ✓
**04-10 — UAT gap closure: Per-service credential files** ✓
**04-11 — UAT gap closure: Confirmation dialogs for Shutdown and Start** ✓

- Container detail page at /containers/[id] with Overview, Services, Events tabs
- refreshContainerServicesAction wiring SSH monitoring → DB
- Full lifecycle action buttons in header with AlertDialog for destructive actions
- Server-side credential decryption for per-service credential reveal
- 30s auto-refresh, event timeline with filters, resource usage bars
- **UAT fixes (04-05):**
  - Clean sidebar navigation (removed redundant Containers item)
  - Always-visible Create Container button in dashboard header
  - Card-level loading indicators for lifecycle actions with persistent visual feedback
- **Gap closure fixes (04-06):**
  - Fixed ha.managed schema to accept Proxmox 0/1 integers via pveBoolean helper (resolves lifecycle action failures)
  - Added comprehensive error logging to all Proxmox API catch blocks for diagnostics
- **Gap closure fixes (04-07):**
  - Regenerated Prisma Client with hostname field to fix container creation validation errors
  - Added postinstall hook to prevent future schema/client drift
- **Gap closure fixes (04-08):**
  - Applied Prisma migration to add hostname column to PostgreSQL database
  - Complete schema sync achieved: Prisma schema ↔ Prisma Client ↔ PostgreSQL database
- **Gap closure fixes (04-09):**
  - Added getRuntimeIp function to query Proxmox guest agent for actual container IP
  - Service refresh now works for DHCP containers via runtime IP fallback
  - Graceful error handling when container stopped or agent unavailable
- **Gap closure fixes (04-10):**
  - Updated save_credential() to create per-service credential files in /etc/infrahaus/credentials/{service}.env
  - Template installation now creates discoverable credential format matching monitoring expectations
  - Enables dashboard "Show Credentials" feature for new containers
- **Gap closure fixes (04-11):**
  - Added confirmation dialogs for Start and Shutdown lifecycle actions
  - Four of five lifecycle operations now require user confirmation (Start, Shutdown, Stop, Delete; Restart executes immediately)
  - Consistent UX with educational messaging and color-coded action buttons

### Phase 3.5: Infrastructure Refactor (In Progress)

**03.5-01 — Schema migration + DB service refactor** ✓

- ProxmoxNode model: added userId, isDefault, sshPassword fields with compound unique (userId, name)
- Container model: removed rootPassword (clean break)
- DatabaseService: userId-scoped node methods (listNodesForUser, getDefaultNodeForUser, setDefaultNode, etc.)

**03.5-02 — Session-based auth flow** ✓

- authActionClient checks Redis session via getSessionData(), provides userId in ctx
- loginAction authenticates against Proxmox ticket API and creates Redis session
- logoutAction destroys session and redirects to /login
- Middleware redirects unauthenticated users to /login (cookie check)
- Login page with host, port, username, password, realm fields

**03.5-03 — VMID cache module + node CRUD server actions** ✓

- Redis VMID cache: refreshVmidCache, isVmidTaken, invalidateVmidCache, getCachedVmids (SET with 5m TTL)
- Node CRUD: createNodeAction, updateNodeAction, deleteNodeAction, setDefaultNodeAction, testNodeConnectionAction
- Connection testing on create/update (hit /version endpoint before persisting)
- Auto-default first node, delete protection for nodes with containers

**03.5-04 — Container actions & data layer migration to DB-based auth** ✓

- Deleted getProxmoxClient() entirely from proxmox/index.ts; added getProxmoxClientForNode() convenience function
- All 8 container call sites (actions.ts + data.ts) use createProxmoxClientFromNode()
- rootPassword removed from container schemas (base, config, input)
- getContainersWithStatus() accepts userId, iterates user's DB nodes in parallel
- getContainerDetailData() resolves Proxmox client from container.node relation
- SSH in refreshContainerServicesAction uses node.sshPassword from DB
- Dashboard and wizard pages pass session userId to data layer
- VMID cache invalidation wired into container create and delete

**03.5-05 — Worker + service logs route migration to DB-based auth** ✓

- Worker resolves Proxmox client from DB via createProxmoxClientFromNode(node) instead of env-var getProxmoxClient()
- Worker SSH uses node.host + decrypt(node.sshPassword) from DB
- Worker generates random password for Proxmox API container creation (not stored)
- Service logs route uses container.node relation for SSH credentials with session auth check
- rootPassword removed from ContainerJobData, container schemas, and enqueue call
- Zero PVE_HOST/PVE_ROOT_PASSWORD references in workers/ or app/api/

## Decisions Made

- Tech stack locked: Next.js 15, shadcn/ui, Tailwind v4, Prisma, PostgreSQL, Redis, BullMQ
- DatabaseService class pattern for data access + direct prisma export for transactions
- useActionState for form-based mutations, useTransition for direct server action calls
- Delete+recreate for child records (scripts/files/packages) ensures clean sync
- Tags stored as semicolon-separated string matching template.conf format
- Templates page under (dashboard) route group for sidebar layout inheritance
- Server-side filtering via URL search params for shareability
- BucketFormDialog uses mode prop (create/edit) to avoid duplicate dialog components
- Sonner toasts for all CRUD feedback; Toaster in root layout for app-wide access
- Tab components: Server Components for static display, Client Components for collapsible state
- File policy badges color-coded: replace=destructive, default=secondary, backup=outline
- Hidden JSON fields for complex nested data serialization in forms
- Bucket selection copies packages into template (template owns its package list)
- **CONVENTION: Always use shadcn/ui components** — never create custom HTML elements (badges, alerts, forms, selects, etc.) when a shadcn component exists or can be installed. Custom implementations only as last resort. Forms must use shadcn Form (react-hook-form) not raw `<form>` tags. Documented in `apps/dashboard/CLAUDE.md`. (#102)
- **CONVENTION: Cookie writes forbidden in RSC** — never call session.destroy() or modify cookies in Server Components or layouts. Cookie mutations only in Server Actions, Route Handlers, or middleware. (Next.js 16+ requirement)
- Removed server-only from shared modules (kept in session.ts, discovery.ts, parser.ts — Next.js-only)
- Lazy-initialized queue pattern for BullMQ (matches getRedis approach)
- connectWithRetry: 5 attempts, 2s initial delay, exponential backoff for SSH readiness
- Re-exported Prisma enums from db.ts for consumer convenience
- Dual Redis connections in worker: workerConnection (maxRetriesPerRequest: null) + publisher (Pub/Sub)
- Log events Redis-only; step/complete/error events persisted to ContainerEvent table
- Static IP extraction from ipConfig; DHCP discovery deferred
- Config-manager as systemd oneshot service with config.env and config-sync.sh
- Base schema pattern: split Zod schemas into base (for react-hook-form) and refined (for server validation) when using zodResolver
- Manual password confirmation in onSubmit to avoid .refine() type mismatch with zodResolver
- Template packages grouped by manager as toggle-able buckets in wizard UI
- SSE replay pattern: replay persisted ContainerEvent rows on connect before Redis Pub/Sub subscription
- Terminal state shortcircuit: if container is ready/error, replay and close without Redis subscription
- Services fetched on completion via /api/containers/[id]/services rather than embedded in SSE stream
- Monitoring: batch systemctl show for efficiency; port 22 filtered from discovery; error-in-result pattern (never throws)
- Redis NX+EX lock (300s TTL, ownership token + Lua compare-and-delete) prevents concurrent lifecycle actions on same container
- Shutdown: 30s graceful timeout, fallback to force stop
- Delete: purge=true on Proxmox API, then cascade delete in DB
- getContainersWithStatus fetches all node containers in parallel → VMID→status map for O(1) lookup
- useAutoRefresh with router.refresh() for server component re-fetching
- ContainerActions uses useTransition for non-blocking action calls
- Full lifecycle buttons in detail header (not dropdown) for better UX
- Server-side credential decryption in getContainerDetailData
- Dynamic imports for monitoring/encryption in refreshContainerServicesAction
- postinstall hook runs `prisma generate` to prevent schema/client drift (after install, branch switch, CI/CD)
- prisma migrate resolve for baselining existing database schema before applying new migrations
- Per-service credential files pattern: /etc/infrahaus/credentials/{service}.env enables credential discovery
- Proxmox guest agent API for runtime IP discovery (DHCP containers)
- Two-phase IP resolution: static config first, runtime agent query fallback
- Graceful null return pattern for agent queries (stopped containers expected)
- Clean data migration for infra-refactor: DELETE existing containers/nodes before adding required userId NOT NULL column
- getNodeById stays unscoped by userId — worker has no session, receives nodeId directly
- Transaction-based default node swap (unset all + set one) avoids partial unique index complexity
- authActionClient reads session via getSessionData() and provides userId (Proxmox username) in ctx
- loginAction uses actionClient (not authActionClient) since user isn't authenticated yet
- Middleware checks SESSION_COOKIE_NAME constant for cookie presence (Edge-safe, no Redis/Node)
- VMID cache uses Redis SET (SADD/SISMEMBER/SMEMBERS) with 5-minute TTL per node
- Connection test via /version endpoint before persisting node credentials
- sshPassword update: provided=encrypt, empty string=clear to null, undefined=keep existing
- vmid-cache.ts has no "server-only" — worker needs it for cache invalidation
- Worker generates random 32-char hex password for Proxmox API container creation — not stored, containers accessed via pct exec
- rootPassword removed from ContainerJobData and container schemas in plan 05 (not deferred to 07)
- Service logs API route requires session auth via getSessionData()
- getContainersWithStatus iterates user's DB nodes in parallel (not cluster listNodes API) with per-node error isolation
- getContainerDetailData resolves client from container.node relation (no userId needed)
- Dashboard page.tsx follows same session-check pattern as wizard page (getSessionData + redirect)

## Pending Work

- Phase 3.5: Plans 06-08 remaining (settings UI, wizard updates, dashboard updates)
  - Note: Client-side wizard still has rootPassword form fields (stripped by Zod) — clean up in Plan 07
- Phase 5: Web UI & Monitoring (#87-88)
- Phase 6: CI/CD & Deployment (#89-90)

## Blockers/Concerns

- Docker-in-Docker networking: Coder workspace must join dashboard_default network for Redis/Postgres access (not localhost)

## Accumulated Context

### Roadmap Evolution

- Phase 07 added: VM to Run OpenClaw
- Phase 08 added: Proxmox LXC Container Template Engine

## Session Continuity

Last session: 2026-02-20
Stopped at: Completed 03.5-04-PLAN.md (container actions & data migration)
Resume file: None
