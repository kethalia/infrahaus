# LXC Template Manager Dashboard — Roadmap

## Overview

Full-stack web app (`apps/dashboard`) for creating, configuring, and managing LXC containers on Proxmox VE. Replaces manual shell-based workflow with a visual UI built on the existing config-manager system in `infra/lxc/`.

## Phases

### Phase 01: Foundation

**Goal:** Working dev environment with database, Proxmox API client, and SSO authentication
**Status:** 75% complete — SSO auth (#75) remaining
**Plans:** 2 plans

Plans:

- [ ] 01-01-PLAN.md — Session infrastructure, auth server actions, and login page UI
- [ ] 01-02-PLAN.md — Route protection middleware, conditional layout, and sidebar logout

---

### Phase 02: Template System

**Goal:** Users can browse, view, create, and edit LXC templates with package bucket management
**Status:** Not started
**Plans:** 0 plans

Plans:

- [ ] TBD — template discovery, browser, editor, package buckets

Issues: #76, #77, #78, #79

---

### Phase 03: Container Creation

**Goal:** Users can configure and create LXC containers through a multi-step wizard with real-time progress
**Status:** Not started
**Plans:** 0 plans

Plans:

- [ ] TBD — configuration wizard, creation engine, progress tracking

Issues: #80, #81, #82

---

### Phase 04: Container Management

**Goal:** Users can monitor and control container lifecycle with a dashboard overview
**Status:** Not started
**Plans:** 0 plans

Plans:

- [ ] TBD — dashboard, lifecycle controls, service monitoring, detail page

Issues: #83, #84, #85, #86

---

### Phase 05: Web UI & Monitoring

**Goal:** Service discovery with web UI access links and resource usage monitoring
**Status:** Not started
**Plans:** 0 plans

Plans:

- [ ] TBD — service discovery, resource monitoring

Issues: #87, #88

---

### Phase 06: CI/CD & Deployment

**Goal:** Docker deployment configuration and CI/CD pipeline with E2E testing
**Status:** Not started
**Plans:** 0 plans

Plans:

- [ ] TBD — Docker config, CI/CD pipeline

Issues: #89, #90
