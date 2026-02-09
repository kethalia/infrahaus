# Project State

## Current Position

**Project:** LXC Template Manager Dashboard (apps/dashboard)
**Phase:** 04-container-management — Complete
**Plan:** 6 of 6 in current phase
**Status:** Phase complete
**Last activity:** 2026-02-09 — Completed 04-06-PLAN.md (gap closure)

Progress: █████████░ 89% (17/19 plans)

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
**04-05 — Gap closure: Zod boolean field fix** ✓
**04-06 — Gap closure: Hostname persistence and graceful degradation** ✓

- Container detail page at /containers/[id] with Overview, Services, Events tabs
- refreshContainerServicesAction wiring SSH monitoring → DB
- Full lifecycle action buttons in header with AlertDialog for destructive actions
- Server-side credential decryption for per-service credential reveal
- 30s auto-refresh, event timeline with filters, resource usage bars
- Hostname persistence in database with Proxmox fallback
- Graceful UI degradation when Proxmox API unreachable

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
- Hostname fallback chain: Proxmox live data > DB hostname field > null display
- Show disabled buttons with tooltips rather than hiding when Proxmox unreachable
- Delete remains enabled when Proxmox down (DB deletion works independently)

## Pending Work

- Phase 5: Web UI & Monitoring (#87-88)
- Phase 6: CI/CD & Deployment (#89-90)

## Blockers/Concerns

- Docker-in-Docker networking: Coder workspace must join dashboard_default network for Redis/Postgres access (not localhost)

## Accumulated Context

### Roadmap Evolution

- Phase 07 added: VM to Run OpenClaw
- Phase 08 added: Proxmox LXC Container Template Engine

## Session Continuity

Last session: 2026-02-09T20:26:46Z
Stopped at: Completed 04-06-PLAN.md
Resume file: None
