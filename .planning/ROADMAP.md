# LXC Template Manager Dashboard — Roadmap

## Overview

Full-stack web app (`apps/dashboard`) for creating, configuring, and managing LXC containers on Proxmox VE. Replaces manual shell-based workflow with a visual UI built on the existing config-manager system in `infra/lxc/`.

## Phases

### Phase 01: Foundation ✓

**Goal:** Working dev environment with database, Proxmox API client, and SSO authentication
**Status:** Complete
**Completed:** 2026-02-06
**Plans:** 2 plans

Plans:

- [x] 01-01-PLAN.md — Session infrastructure, auth server actions, and login page UI
- [x] 01-02-PLAN.md — Route protection middleware, conditional layout, and sidebar logout

---

### Phase 02: Template System ✓

**Goal:** Users can browse, view, create, and edit LXC templates with package bucket management
**Status:** Complete
**Completed:** 2026-02-06
**Plans:** 5 plans

Plans:

- [x] 02-01-PLAN.md — Template discovery engine (filesystem parser + DB sync + server action)
- [x] 02-02-PLAN.md — Template DatabaseService methods + browser page with search/filter
- [x] 02-03-PLAN.md — Package bucket CRUD (DatabaseService + server actions + management UI)
- [x] 02-04-PLAN.md — Template detail page with tabbed view (Config, Scripts, Packages, Files)
- [x] 02-05-PLAN.md — Template creator and editor forms (multi-section form with scripts/files/packages)

Issues: #76, #77, #78, #79

---

### Phase 03: Container Creation ✓

**Goal:** Users can configure and create LXC containers through a multi-step wizard with real-time progress
**Status:** Complete
**Completed:** 2026-02-08
**Plans:** 5 plans

Plans:

- [x] 03-01-PLAN.md — Infrastructure: remove server-only guards, SSH session helper, BullMQ queue setup
- [x] 03-02-PLAN.md — Container creation engine: BullMQ worker with 5-phase pipeline
- [x] 03-03-PLAN.md — Wizard UI: 5-step container configuration form with server action
- [x] 03-04-PLAN.md — Progress tracking: SSE endpoint, useContainerProgress hook, progress page UI
- [x] 03-05-PLAN.md — Gap closure: OS template selector in wizard Configure step

Issues: #80, #81, #82

---

### Phase 03.5: Infrastructure Refactor

**Goal:** Remove stored container passwords, cache VMIDs from Proxmox via Redis, and replace env-var auth with multi-user DB-stored credentials
**Status:** Complete
**Completed:** 2026-02-23
**Depends on:** Phase 03
**Plans:** 8 plans

Key deliverables:

- Refactor monitoring engine to use `PctExecSession` (pct exec via Proxmox host) instead of direct SSH into containers
- Remove `rootPassword` from Container model — no longer needed once monitoring uses pct exec
- Drop password field from creation wizard (Proxmox API still sets it, but we don't store it)
- Cache existing VMIDs from Proxmox nodes in Redis, revalidate on container create/delete
- VMID picker in wizard pulls from cached node data instead of local DB unique constraint
- Settings page to add/edit/delete Proxmox nodes with encrypted credentials
- Migrate `getProxmoxClient()` to resolve credentials from DB `ProxmoxNode` records
- Remove dependency on `PVE_HOST`, `PVE_PORT`, `PVE_ROOT_PASSWORD` env vars
- `ProxmoxNode` Prisma model already has `host`, `port`, `tokenId`, `tokenSecret` fields

Plans:

- [x] 03.5-01-PLAN.md — Schema migration + DB service refactor (userId on ProxmoxNode, remove rootPassword)
- [x] 03.5-02-PLAN.md — Auth refactor (session-based authActionClient, login/logout, middleware)
- [x] 03.5-03-PLAN.md — VMID cache module + node CRUD server actions
- [x] 03.5-04-PLAN.md — Proxmox client migration (all container action/data call sites)
- [x] 03.5-05-PLAN.md — Worker + service logs route migration to DB-based auth
- [x] 03.5-06-PLAN.md — Settings page UI (/settings/nodes)
- [x] 03.5-07-PLAN.md — Wizard updates (password removal, VMID validation, node selector)
- [x] 03.5-08-PLAN.md — Dashboard updates (node badge, filtering, no-nodes banner)

---

### Phase 03.6: Remove Container from Database ✓

**Goal:** Remove Container and ContainerEvent models from PostgreSQL. Proxmox becomes sole source of truth for container state. Redis provides ephemeral creation tracking and service caching.
**Status:** Complete
**Completed:** 2026-02-22
**Depends on:** Phase 03.5
**Plans:** 6 plans

Key deliverables:

- Redis-based creation state module replaces DB Container model for in-progress jobs
- Container creation action + worker write to Redis instead of PostgreSQL
- Dashboard and detail pages fetch from Proxmox API exclusively (Redis for creation state)
- SSE progress route uses Redis ring buffer only (no DB ContainerEvent replay)
- Lifecycle actions (start/stop/shutdown/restart/delete) operate without DB Container records
- Container and ContainerEvent tables dropped from PostgreSQL
- All container IDs are VMIDs (uniform, no more cuid/pve-{vmid} mix)
- Dashboard loading skeletons, empty states, and node failure graceful degradation
- Service cache 24h TTL, manual refresh, first-visit auto-fetch, "last checked" timestamp
- Detail page 1-2s resource metric polling

Plans:

- [x] 03.6-01-PLAN.md — Redis creation state module (key patterns, TTLs, CRUD functions)
- [x] 03.6-02-PLAN.md — Creation flow + actions refactor (action, worker, lifecycle → Redis)
- [x] 03.6-03-PLAN.md — Data layer + routes + UI → Proxmox/Redis only
- [x] 03.6-04-PLAN.md — Schema removal + DatabaseService cleanup + build verification
- [x] 03.6-05-PLAN.md — Dashboard UX: loading skeletons, empty states, error degradation
- [x] 03.6-06-PLAN.md — Service cache lifecycle + detail page resource polling

---

### Phase 04: Container Management ✓

**Goal:** Users can monitor and control container lifecycle with a dashboard overview
**Status:** Complete
**Completed:** 2026-02-16
**Plans:** 11 plans

Plans:

- [x] 04-01-PLAN.md — Lifecycle server actions (start/stop/shutdown/restart/delete) + DB query methods + client helper
- [x] 04-02-PLAN.md — Service monitoring engine (SSH-based service/port/credential checks)
- [x] 04-03-PLAN.md — Container dashboard page (summary bar, container cards, filters, auto-refresh)
- [x] 04-04-PLAN.md — Container detail page (/containers/[id] with Overview, Services, Events tabs)
- [x] 04-05-PLAN.md — Gap closure: Fix navigation redundancy and add Create Container button; add card-level loading indicators
- [x] 04-06-PLAN.md — Gap closure: Fix ha.managed schema validation and add Proxmox error logging
- [x] 04-07-PLAN.md — Gap closure: Regenerate Prisma Client and add postinstall hook to prevent schema drift
- [x] 04-08-PLAN.md — Gap closure: Apply Prisma migration to add hostname column to database
- [x] 04-09-PLAN.md — UAT gap closure: DHCP container service refresh via Proxmox guest agent runtime IP query
- [x] 04-10-PLAN.md — UAT gap closure: Per-service credential files in template installation scripts
- [x] 04-11-PLAN.md — UAT gap closure: Confirmation dialogs for Shutdown and Start actions

Issues: #83, #84, #85, #86

---

### Phase 04.5: Auth Decoupling — RainbowKit + Universal Profiles ✓

**Goal:** Replace Proxmox-coupled authentication with RainbowKit Sign-In with Ethereum (SIWE), restricted to Universal Profiles only. Proxmox nodes stored per connected Universal Profile address. Sessions store signature + message + message hash in Redis with expiry based on signature message.
**Status:** Complete
**Completed:** 2026-02-24
**Depends on:** Phase 03.5 (session infrastructure), Phase 04 (dashboard complete)
**Plans:** 4 plans

Key deliverables:

- Remove Proxmox ticket-based login flow entirely
- RainbowKit integration with Universal Profile-only wallet connector
- SIWE session model: signature + message + messageHash stored in Redis with message-derived expiry
- User identity = Universal Profile address (replaces Proxmox username throughout)
- Proxmox node credentials (API token, SSH password) stored per UP address in ProxmoxNode model
- userId column migration from Proxmox username to wallet address
- Login page → RainbowKit connect modal → dashboard
- No-nodes state becomes the real first-login experience
- All existing features (containers, templates, wizard, settings) work with new auth

Plans:

- [x] 04.5-01-PLAN.md — Web3 dependencies (RainbowKit + wagmi) + session layer rewrite for SIWE
- [x] 04.5-02-PLAN.md — SIWE auth API routes (nonce, verify, logout, me) + auth actions cleanup
- [x] 04.5-03-PLAN.md — Proxmox client refactor + identity migration (session.username → session.address)
- [x] 04.5-04-PLAN.md — Login UI (RainbowKit ConnectButton) + Web3Provider + build verification

---

### Phase 04.6: Pool-Based Proxmox Access Control

**Goal:** Wire Proxmox resource pools through the dashboard so each user's containers are isolated in their own pool. Enables least-privilege API tokens where users can only see and manage containers they created — critical for shared nodes.
**Status:** Not started
**Depends on:** Phase 04.5 (auth decoupling)
**Plans:** 1 plan

Key deliverables:

- `pool` column on ProxmoxNode model (optional — backward compatible)
- Pool field in node settings form (Settings → Nodes → Add/Edit)
- Container creation pipeline passes pool to Proxmox API (`POST /nodes/{node}/lxc` pool param)
- API token setup guide documents pool-based isolation as the recommended default

Plans:

- [ ] 04.6-01-PLAN.md — Add pool to ProxmoxNode model, node form, creation pipeline, and setup guide

---

### Phase 05: Web UI & Monitoring

**Goal:** Service discovery with web UI access links and resource usage monitoring
**Status:** Complete
**Depends on:** Phase 04.6
**Plans:** 2 plans (2/2 complete)

Plans:

- [x] 05-01-PLAN.md — RRD data API backend + Globe web-links dropdown on dashboard cards
- [x] 05-02-PLAN.md — Resource history area charts (CPU, Memory, Disk, Network I/O) on Overview tab

Issues: #87, #88

---

### Phase 06: CI/CD & Deployment

**Goal:** Docker deployment configuration and CI/CD pipeline with E2E testing
**Status:** Not started
**Plans:** 0 plans

Plans:

- [ ] TBD — Docker config, CI/CD pipeline

Issues: #89, #90

---

### Phase 07: VM to Run OpenClaw

**Goal:** Create a VM template in infra/ that provisions a Debian 13 desktop VM with XFCE, Chrome, Node.js, VNC, and OpenClaw using the ProxmoxVE community script as foundation
**Depends on:** Phase 06
**Plans:** 3 plans

Plans:

- [ ] 07-01-PLAN.md — VM template structure: template.conf, minimal cloud-init bootstrap, and create-vm.sh wrapper
- [ ] 07-02-PLAN.md — Post-install scripts (canonical software source): desktop, user, Chrome, Node.js, VNC, OpenClaw, validation
- [ ] 07-03-PLAN.md — Script runner (run-scripts.sh) and README documentation

---

### Phase 08: Proxmox LXC Container Template Engine

**Goal:** Reusable, config-driven template system that deploys fully provisioned LXC containers on Proxmox via declarative YAML config and convention-based directory structure, shipping "forge-shield" as the first template — a full-stack + EVM dev environment with GSD/OpenCode and integrated security tooling
**Depends on:** Phase 07
**Plans:** 9 plans

Plans:

- [ ] 08-01-PLAN.md — Engine library modules (logging, config, state, container, files, hooks)
- [ ] 08-02-PLAN.md — Engine deploy.sh main entry point with full deployment pipeline
- [ ] 08-03-PLAN.md — forge-shield template.yaml + base system and user creation scripts
- [ ] 08-04-PLAN.md — forge-shield language runtime scripts (Node, Python, Go, Rust)
- [ ] 08-05-PLAN.md — forge-shield EVM tools (Foundry, solc-select) + AI tools (Claude Code, OpenCode, GSD)
- [ ] 08-06-PLAN.md — forge-shield security tool scripts (web + Solidity + ZAP)
- [ ] 08-07-PLAN.md — forge-shield files/ (commands, scripts, CLAUDE.md, tmux.conf) + hooks/ + minimal/ template
- [ ] 08-08-PLAN.md — Engine README + integration verification checkpoint
- [ ] 08-09-PLAN.md — forge-shield setup scripts (Claude skills, shell config, verification)
