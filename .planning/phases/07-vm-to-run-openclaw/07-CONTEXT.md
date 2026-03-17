# Phase 7: VM to Run OpenClaw - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a VM template in `infra/vm/templates/openclaw-desktop/` that provisions a Debian 13 desktop VM with XFCE, Chrome, Node.js, VNC, and OpenClaw. Uses the ProxmoxVE community Debian 13 VM script as foundation. Three files drive deployment: `create-vm.sh` (Proxmox VM creation), `cloud-init/user-data.yaml` (minimal user/SSH bootstrap), and numbered scripts in `scripts/` (all software installation). A `run-scripts.sh` orchestrator runs all scripts via SSH after VM creation.

</domain>

<decisions>
## Implementation Decisions

### Architecture
- Cloud-init is intentionally MINIMAL: creates `openclaw` user, enables SSH, installs basic prerequisites (curl, git, ca-certs, qemu-guest-agent). Does NOT install any desktop software.
- All software installation is handled exclusively by numbered scripts in `scripts/` — single source of truth for reproducibility and re-runnability.
- Two-phase workflow: `create-vm.sh` → wait for cloud-init (~2-3 min) → `run-scripts.sh <VM_IP>` installs full desktop.

### VM Configuration
- Base OS: Debian 13 "Trixie" cloud image
- Desktop: XFCE + LightDM with auto-login for `openclaw` user
- Default resources: 4 CPU, 4096MB RAM, 32G disk (desktop-appropriate)
- BIOS: OVMF (UEFI), machine: q35, display: virtio-gpu
- QEMU guest agent installed and enabled

### Remote Access
- VNC via TigerVNC on port 5901 (`-localhost no` for direct access)
- Default VNC password: `openclaw` (user should change post-setup)
- Also accessible via Proxmox console (noVNC in web UI) and SSH

### SSH User in run-scripts.sh
- SSH as `root` as planned — community script may configure root login
- Claude's Discretion: if Debian 13 cloud image disables root SSH by default, fall back to `openclaw` with passwordless sudo

### OpenClaw Installation
- Claude's Discretion: Verify `openclaw` exists on npm before scripting. Script 06 should be written defensively — if `npm install -g openclaw@latest` fails, print a clear error with instructions to install from the correct source.
- If not a public npm package, script should provide a placeholder with a TODO comment pointing to the correct installation method.

### VM vs Template Conversion
- create-vm.sh leaves the VM running (not converted to Proxmox template via `qm template`)
- A running VM is immediately usable; template conversion prevents starting directly
- User can manually run `qm template <VMID>` if cloning is needed later

### Script Conventions
- Numbered scripts (00-99): each handles one concern, idempotent, standalone-executable
- No config-manager framework dependency (scripts run standalone in the VM)
- Simple echo-based logging with color prefixes (not log_info/log_error from config-manager)
- All scripts: `#!/usr/bin/env bash`, `set -euo pipefail`, `chmod +x`

### User Account
- Username: `openclaw`
- Initial password: `openclaw` (force-change on first interactive login via `chage -d 0`)
- Groups: `sudo, audio, video, render`
- Passwordless sudo configured for script automation (can restrict post-setup)

### Claude's Discretion
- Exact VNC geometry and color depth settings
- npm global prefix configuration for openclaw user
- Whether to add xrdp as additional remote access
- Chrome flag configuration for running as non-root
- Exact validation checks in 99-post-setup.sh
- How run-scripts.sh falls back if root SSH is disabled

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `infra/lxc/templates/web3-dev/template.conf`: TEMPLATE_* variable pattern — adapt for VM-specific vars (TEMPLATE_MACHINE, TEMPLATE_BIOS, TEMPLATE_DISPLAY, TEMPLATE_CLOUD_INIT)
- `infra/lxc/templates/web3-dev/container-configs/scripts/`: Numbered script naming convention (00-99) — replicate for VM scripts
- `infra/lxc/templates/web3-dev/README.md`: Documentation pattern (Quick Start, File Structure, Troubleshooting)

### Established Patterns
- `template.conf` sourced by creation script for env-var-overridable defaults
- Numbered scripts: single concern, idempotent, re-runnable
- `bash -c` subshell for community scripts (can't `source` interactive whiptail VM scripts)

### Integration Points
- `infra/vm/templates/openclaw-desktop/` — new directory (infra/vm/ doesn't exist yet)
- Community script: ProxmoxVE community Debian 13 VM script via curl
- Proxmox snippets: `/var/lib/vz/snippets/` for cloud-init user-data

</code_context>

<specifics>
## Specific Ideas

- run-scripts.sh: copies scripts to /tmp/openclaw-setup/ via SCP, executes in order via SSH, cleans up on exit
- VM creation: detect VMID by hostname scan of `qm list` after community script completes (can't capture from subshell)
- VNC: `-localhost no` for direct client connections
- Cloud-init: `chage -d 0 openclaw` forces password change on first interactive login

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-vm-to-run-openclaw*
*Context gathered: 2026-03-08*
