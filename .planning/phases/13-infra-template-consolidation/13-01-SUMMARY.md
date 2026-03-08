---
phase: 13-infra-template-consolidation
plan: "13-01"
subsystem: infra
tags: [lxc, templates, dokploy, wireguard, docker, forge-shield]

requires:
  - phase: 12-web-removal
    provides: Clean monorepo with apps/dashboard as hub

provides:
  - Dokploy LXC template discovered by forge-shield engine
  - WireGuard Proxy LXC template discovered by forge-shield engine
  - Numbered install scripts for both templates (pre-checks, docker, app-specific)
  - Package lists (base.apt) and Docker Compose files under container-configs/

affects: [dashboard-templates-page, forge-shield-runner, phase-14-branding]

tech-stack:
  added: []
  patterns:
    - "LXC template structure: template.conf + container-configs/{scripts,packages,files}/"
    - "Script naming: 00-pre-checks, 01-docker-install, 02-<app>-install"
    - "File provisioning metadata: .path (destination) + .policy (copy|symlink) alongside source"

key-files:
  created:
    - infra/lxc/templates/dokploy/template.conf
    - infra/lxc/templates/dokploy/container-configs/scripts/00-pre-checks.sh
    - infra/lxc/templates/dokploy/container-configs/scripts/01-docker-install.sh
    - infra/lxc/templates/dokploy/container-configs/scripts/02-dokploy-install.sh
    - infra/lxc/templates/dokploy/container-configs/packages/base.apt
    - infra/lxc/templates/dokploy/container-configs/files/opt/dokploy/docker-compose.yaml
    - infra/lxc/templates/wireguard-proxy/template.conf
    - infra/lxc/templates/wireguard-proxy/container-configs/scripts/00-pre-checks.sh
    - infra/lxc/templates/wireguard-proxy/container-configs/scripts/01-docker-install.sh
    - infra/lxc/templates/wireguard-proxy/container-configs/scripts/02-wireguard-install.sh
    - infra/lxc/templates/wireguard-proxy/container-configs/packages/base.apt
    - infra/lxc/templates/wireguard-proxy/container-configs/files/opt/wireguard-proxy/docker-compose.yaml
  modified: []

key-decisions:
  - "Dokploy: unprivileged=1, nesting=1 — Docker Swarm works in unprivileged containers with nesting"
  - "WireGuard Proxy: unprivileged=0 (privileged) — WireGuard kernel module requires privileged container for modprobe"
  - "01-docker-install.sh is a verbatim copy of web3-dev/02-docker-install.sh — Docker CE install is identical across templates"
  - "ADVERTISE_ADDR detection in 02-dokploy-install.sh falls back via ifconfig.io → icanhazip.com → ip route get 1 — same logic as infra/dokploy/install.sh"
  - "WireGuard module persisted to /etc/modules for reboot survival"

requirements-completed:
  - REQ-2.05

duration: 18min
completed: "2026-03-08"
---

# Phase 13 Plan 01: Infra Inventory + LXC Template Definitions Summary

**Dokploy and WireGuard Proxy LXC templates with full install scripts, package lists, and compose files wired into the forge-shield discovery engine**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-08T18:45:00Z
- **Completed:** 2026-03-08T19:03:00Z
- **Tasks:** 5
- **Files modified:** 16

## Accomplishments

- Dokploy template: `template.conf` with all required TEMPLATE_* fields (CPU=2, RAM=2048, Disk=20, debian 12, unprivileged+nesting), three numbered install scripts, base.apt package list, and docker-compose.yaml sourced from `infra/dokploy/`
- WireGuard Proxy template: `template.conf` (CPU=1, RAM=512, Disk=8, privileged), three numbered install scripts including wireguard kernel module load + persistence, base.apt with wireguard-tools, and compose file sourced from `infra/wireguard/`
- `pnpm --filter dashboard exec tsc --noEmit` exits 0 — no dashboard type regressions

## Task Commits

Each task was committed atomically:

1. **Task 13-01-01: Create Dokploy LXC template.conf** - `b2186ec` (feat)
2. **Task 13-01-02: Create Dokploy LXC install scripts** - `028d28d` (feat)
3. **Task 13-01-03: Create Dokploy package list and compose file** - `ca5416b` (feat)
4. **Task 13-01-04: Create WireGuard Proxy LXC template.conf** - `5ac8c26` (feat)
5. **Task 13-01-05: Create WireGuard Proxy LXC install scripts and packages** - `d102be9` (feat)

## Files Created/Modified

- `infra/lxc/templates/dokploy/template.conf` - TEMPLATE_APP=Dokploy, all 11 required TEMPLATE_* fields
- `infra/lxc/templates/dokploy/container-configs/scripts/00-pre-checks.sh` - OS/memory/disk/network checks, 2048 MB threshold
- `infra/lxc/templates/dokploy/container-configs/scripts/01-docker-install.sh` - Docker CE via official script
- `infra/lxc/templates/dokploy/container-configs/scripts/02-dokploy-install.sh` - swarm init, overlay network, port checks, compose up
- `infra/lxc/templates/dokploy/container-configs/packages/base.apt` - curl, ca-certificates, gnupg, iproute2
- `infra/lxc/templates/dokploy/container-configs/files/opt/dokploy/docker-compose.yaml` - verbatim copy from infra/dokploy/
- `infra/lxc/templates/dokploy/container-configs/files/opt/dokploy/docker-compose.yaml.{path,policy}` - forge-shield provisioning metadata
- `infra/lxc/templates/wireguard-proxy/template.conf` - TEMPLATE_APP="WireGuard Proxy", unprivileged=0
- `infra/lxc/templates/wireguard-proxy/container-configs/scripts/00-pre-checks.sh` - OS/memory/disk/network checks, 512 MB threshold
- `infra/lxc/templates/wireguard-proxy/container-configs/scripts/01-docker-install.sh` - verbatim Docker CE install
- `infra/lxc/templates/wireguard-proxy/container-configs/scripts/02-wireguard-install.sh` - modprobe wireguard, /etc/modules persistence, compose up, logs NPM URL at :81
- `infra/lxc/templates/wireguard-proxy/container-configs/packages/base.apt` - adds wireguard-tools
- `infra/lxc/templates/wireguard-proxy/container-configs/files/opt/wireguard-proxy/docker-compose.yaml` - verbatim copy from infra/wireguard/
- `infra/lxc/templates/wireguard-proxy/container-configs/files/opt/wireguard-proxy/docker-compose.yaml.{path,policy}` - forge-shield provisioning metadata

## Decisions Made

- Dokploy uses `unprivileged=1` with `nesting=1` — Docker Swarm operates correctly in unprivileged LXC containers when nesting is enabled
- WireGuard Proxy uses `unprivileged=0` — the WireGuard kernel module requires a privileged container for `modprobe wireguard` to succeed
- Docker install script is reused verbatim across both templates — no template-specific divergence needed in Docker CE install logic
- `02-dokploy-install.sh` mirrors `infra/dokploy/install.sh` port-check and swarm-init logic, adapted for forge-shield log helpers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both templates will be discovered by `discoverTemplatesAction` on the next "Discover Templates" click in the dashboard
- Manual verification: navigate to `/templates` and confirm Dokploy and WireGuard Proxy cards appear; filter by `?tags=infra`
- Ready for Plan 13-02: docker-compose service catalog (Ollama standalone and other services)

---
*Phase: 13-infra-template-consolidation*
*Completed: 2026-03-08*
