# Project State

## Current Position

**Project:** LXC Template Manager Dashboard (apps/dashboard)
**Phase:** 02-template-system — In progress
**Plan:** 1 of 5 in current phase
**Status:** Completed 02-01-PLAN.md
**Last activity:** 2026-02-06 — Completed 02-01-PLAN.md

Progress: ██░░░░░░░░ 20% (3/15 plans)

## Completed Work

### Phase 1: Foundation (Issues #72-75) ✓

- Next.js 15 app with App Router, TypeScript, shadcn/ui, Tailwind v4
- Prisma schema with all models, Prisma client with pg adapter
- ProxmoxClient with retry logic, SSL handling, Zod validation
- iron-session v8 + Redis SSO auth, login page, route protection middleware

### Phase 2: Template System — In Progress

**02-01 — Template discovery engine** ✓

- Pure filesystem parser (template.conf, scripts, packages, config files with sidecars)
- Prisma-based discovery engine with atomic transaction sync
- Server actions: discoverTemplatesAction, getDiscoveryStatus
- prisma instance exported from db.ts for complex operations

## Decisions Made

- Tech stack locked: Next.js 15, shadcn/ui, Tailwind v4, Prisma, PostgreSQL, Redis, BullMQ
- Proxmox auth via ticket-based SSO (not API tokens for user sessions)
- Container lifecycle enum: `creating/ready/error`
- AES-256-GCM encryption for sensitive fields
- DatabaseService class pattern for data access + direct prisma export for transactions
- Port 3001 for dev server
- Cookie stores only session ID — session data in Redis with 2h TTL
- iron-session v8, undici fetch, Edge middleware cookie-existence check
- Pure parser → DB sync separation: parser.ts reads filesystem, discovery.ts writes DB
- Delete+recreate for child records (scripts/files/packages) ensures clean sync
- Packages in PackageBucket with bucketId; templateId reserved for custom packages
- Tags stored as semicolon-separated string matching template.conf format

## Pending Work

- Phase 2: Plans 02-02 through 02-05 (template browser, package CRUD, detail page, editor)
- Phase 3: Container Creation (#80-82)
- Phase 4: Container Management (#83-86)
- Phase 5: Web UI & Monitoring (#87-88)
- Phase 6: CI/CD & Deployment (#89-90)

## Blockers/Concerns

- Docker-in-Docker networking: Coder workspace must join dashboard_default network for Redis/Postgres access (not localhost)

## Session Continuity

Last session: 2026-02-06T08:26:15Z
Stopped at: Completed 02-01-PLAN.md
Resume file: None
