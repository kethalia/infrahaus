# OpenClaw Desktop VM Template

Debian 13 (Trixie) VM with XFCE desktop, TigerVNC, Node.js 22, Google Chrome, and OpenClaw — provisioned on Proxmox VE via a two-phase workflow.

## Overview

This template creates a full graphical desktop virtual machine on Proxmox VE. The VM runs Debian 13 with the XFCE desktop environment, LightDM auto-login, TigerVNC for remote desktop access, Node.js 22, Google Chrome, and OpenClaw.

The setup is split into two phases. `create-vm.sh` handles VM creation and the cloud-init minimal bootstrap: user account, SSH access, and prerequisite packages. Once the VM is reachable, `run-scripts.sh` installs all desktop software by running the numbered scripts in `scripts/` over SSH. This separation means cloud-init stays fast (no large downloads during boot) and every install step can be re-run individually if something fails.

## Requirements

- Proxmox VE 8+ (run `create-vm.sh` on the Proxmox host as root)
- Internet access from the Proxmox host (to download the community VM script and Debian image) and from the VM (to download packages)
- Storage with 35 GB+ available (32 GB VM disk + cloud image download)

## Quick Start

```bash
# Step 1: Create the VM (run on Proxmox host as root)
bash infra/vm/templates/openclaw-desktop/create-vm.sh

# Step 2: Wait for cloud-init bootstrap (~2-3 minutes)
# Monitor: qm agent <VMID> exec -- cat /var/log/cloud-init-output.log
# Get IP:  qm agent <VMID> network-get-interfaces

# Step 3: Install desktop software (~15-20 minutes)
./infra/vm/templates/openclaw-desktop/run-scripts.sh <VM_IP>
```

## What Gets Installed

| Component | Package | Purpose |
|---|---|---|
| XFCE desktop | task-xfce-desktop | Lightweight desktop environment |
| LightDM | lightdm | Display manager with auto-login |
| Google Chrome | google-chrome-stable | Web browser |
| Node.js 22 | via NodeSource | OpenClaw runtime |
| TigerVNC | tigervnc-standalone-server | Remote desktop on port 5901 |
| QEMU Guest Agent | qemu-guest-agent | Proxmox management integration |
| OpenClaw | npm global | Target application |

## File Structure

```
infra/vm/templates/openclaw-desktop/
├── template.conf           # VM configuration defaults
├── create-vm.sh            # Step 1: Create VM with cloud-init
├── run-scripts.sh          # Step 2: Install desktop software
├── cloud-init/
│   └── user-data.yaml      # Minimal bootstrap (user, SSH, prerequisites)
└── scripts/                # Post-install scripts (canonical software source)
    ├── 00-pre-checks.sh    # Environment validation
    ├── 01-setup-user.sh    # openclaw user setup
    ├── 02-desktop-setup.sh # XFCE + LightDM + auto-login
    ├── 03-nodejs-setup.sh  # Node.js 22 via NodeSource
    ├── 04-chrome-install.sh# Google Chrome
    ├── 05-vnc-setup.sh     # TigerVNC on port 5901
    ├── 06-openclaw-install.sh # OpenClaw installation
    └── 99-post-setup.sh    # Validation + welcome message
```

## Configuration

Resource defaults are set in `template.conf` and can be overridden via environment variables before running `create-vm.sh`:

```bash
# Example: customize resources before running create-vm.sh
TEMPLATE_CPU=8 TEMPLATE_RAM=8192 bash create-vm.sh
```

## Accessing the VM

- **Proxmox Console:** Proxmox web UI → VM → Console (noVNC, no client needed)
- **VNC:** `vncviewer <VM_IP>:5901` — password: `openclaw` (set by 05-vnc-setup.sh)
- **SSH:** `ssh openclaw@<VM_IP>` — password: `openclaw` (change on first login)

## Re-running Individual Scripts

All scripts are idempotent and can be re-run safely. Use the single-script mode to fix a specific component without re-running everything:

```bash
# Re-run only VNC setup
./run-scripts.sh <VM_IP> 05-vnc-setup.sh

# Re-run all scripts from scratch
./run-scripts.sh <VM_IP>
```

## Default Credentials

| Access | Username | Password | Notes |
|---|---|---|---|
| SSH | openclaw | openclaw | Must change on first interactive login |
| VNC (port 5901) | — | openclaw | Change with: `vncpasswd` |
| sudo | openclaw | (none) | Passwordless sudo for automation |

## Troubleshooting

- **Cloud-init did not complete:** `qm agent <VMID> exec -- cat /var/log/cloud-init-output.log`
- **SSH connection refused:** Wait 2-3 min after VM starts; cloud-init installs openssh-server during boot
- **run-scripts.sh cannot SSH:** See above; also try `ssh root@<VM_IP>` manually first
- **Black screen / no desktop:** Check `systemctl status lightdm` inside the VM
- **VNC connection refused:** Check `systemctl status vncserver@1` inside the VM
- **OpenClaw not found (script 06 failed):** Script provides installation instructions — check output for TODO message

## Resource Recommendations

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 2 cores | 4 cores |
| RAM | 2 GB | 4 GB |
| Disk | 16 GB | 32 GB |
