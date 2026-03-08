---
project: infrahaus
created: 2026-02-06
current_milestone: v2.0
---

# Infrahaus — Project Overview

## What It Is

Infrahaus is a Proxmox LXC container management platform. The centerpiece is `apps/dashboard` — a Next.js 15 web app for creating, configuring, and managing LXC containers on Proxmox VE. It replaces manual shell-based workflows with a visual UI.

## Milestone History

### v1.0 — LXC Template Manager Dashboard (COMPLETE)
**Delivered:** 2026-03-08
**Branch:** oscar/milestone-1
**Tag:** v1.0

The foundational LXC container management dashboard. Built from scratch:
- Next.js 15 + App Router, Prisma + PostgreSQL, Redis + BullMQ
- Web3 auth (RainbowKit + SIWE + Universal Profiles/LUKSO)
- Template system with package bucket management
- Container creation wizard with real-time progress (SSE)
- Multi-node Proxmox support with pool-based access isolation
- Service discovery, resource monitoring (RRD charts)
- CI/CD pipeline, Docker deployment
- VM template for OpenClaw deployment
- LXC container template engine (forge-shield — full EVM/AI dev environment)

**12 phases, 59 plans, 56 summaries. All requirements satisfied.**

---

## Current Milestone: v2.0 — Dashboard as Hub

**Goal:** Make `apps/dashboard` the centrepiece of the entire repo.

1. **Docs migration** — absorb `apps/web` (Fumadocs) into `apps/dashboard`. Unified /docs route.
2. **Infra consolidation** — wire `infra/` configs into dashboard template engine as manageable templates.
3. **Dashboard as hub** — everything lives in or is accessible from `apps/dashboard`.

See REQUIREMENTS.md and ROADMAP.md for phase details.

## Stack

- **Framework:** Next.js 15 (App Router)
- **Database:** PostgreSQL (Prisma ORM)
- **Cache/Queue:** Redis + BullMQ
- **Auth:** RainbowKit + SIWE + Universal Profiles (LUKSO)
- **Docs:** Fumadocs (MDX-based, to be integrated into dashboard in v2.0)
- **Styling:** Tailwind v4 + shadcn/ui
- **Monorepo:** Turborepo + pnpm

## Key Decisions

- Dashboard-first: `apps/dashboard` is the star; other apps are support
- Identity = Universal Profile address (not Proxmox username)
- Proxmox auth via API tokens per user (not session credentials)
- Container IDs use compound `{nodeName}/{vmid}` format (multi-node safe)
- Always use shadcn/ui components (documented in apps/dashboard/CLAUDE.md)
