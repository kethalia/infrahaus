# LXC Container Template Engine

A config-driven provisioning engine for Proxmox LXC containers. Define your container
in a `template.yaml`, add numbered shell scripts, push files into the container, and
the engine handles the rest.

## Prerequisites

- **Proxmox VE host** — run all commands as `root` on the Proxmox host
- **yq** (Go version by mikefarah) — install if missing:
  ```bash
  wget -q "https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64" \
      -O /usr/local/bin/yq && chmod +x /usr/local/bin/yq
  ```
- **Root access** — `pct` commands require root on Proxmox
- **OS template downloaded** — e.g. `pveam download local ubuntu-24.04-standard_24.04-2_amd64.tar.zst`

## Quick Start

```bash
# Deploy the forge-shield template
./templates/engine/deploy.sh forge-shield --vmid 200

# Preview without executing
./templates/engine/deploy.sh forge-shield --dry-run

# Deploy with a static IP
./templates/engine/deploy.sh forge-shield --vmid 200 --ip 192.168.1.200/24 --gateway 192.168.1.1
```

## Usage

```
deploy.sh <template-name> [OPTIONS]
```

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<template-name>` | Name of the template directory (e.g. `forge-shield`, `minimal`) |

**Options:**

| Flag | Description | Example |
|------|-------------|---------|
| `--vmid N` | Override container VMID | `--vmid 200` |
| `--hostname NAME` | Override container hostname | `--hostname mydev` |
| `--cores N` | Override CPU cores | `--cores 4` |
| `--memory N` | Override memory in MB | `--memory 4096` |
| `--ip ADDR` | Override IP address | `--ip 192.168.1.10/24` or `--ip dhcp` |
| `--gateway ADDR` | Override default gateway | `--gateway 192.168.1.1` |
| `--storage NAME` | Override storage backend | `--storage local-lvm` |
| `--dry-run` | Print resolved config and planned actions; do not execute | |
| `--force` | Destroy existing container and redeploy from scratch | |
| `--destroy` | Destroy container with the resolved VMID and exit | |
| `--resume` | Resume deployment from the last completed script | |
| `--verbose` | Enable debug-level logging (`LOG_LEVEL=debug`) | |
| `--help` | Print usage and exit | |

**Config resolution order** (CLI flag overrides YAML, YAML overrides defaults):

```
CLI flag > template.yaml value > built-in default
```

## Template Structure

```
my-template/
├── template.yaml           # Required: declarative config (see reference below)
├── scripts/                # Numbered provisioning scripts (run inside container)
│   ├── 00_base.sh          # Executed first (locale, timezone, base setup)
│   ├── 10_node.sh          # Language runtime
│   └── 99_verify.sh        # Run last (verification/summary)
├── files/                  # Files pushed into the container
│   └── home/USER/          # USER is replaced with the actual username
│       ├── .bashrc         # Example: shell config for the user
│       └── .local/bin/     # Example: user scripts
└── hooks/                  # Lifecycle hooks (optional)
    ├── pre-deploy.sh       # Runs on the HOST before container creation
    └── post-deploy.sh      # Runs INSIDE the container after all scripts
```

## Creating a New Template

1. **Copy `minimal/` as your starting point:**
   ```bash
   cp -r templates/minimal/ templates/my-template/
   ```

2. **Edit `template.yaml`** with your container config:
   ```bash
   vim templates/my-template/template.yaml
   ```

3. **Add numbered scripts** to `scripts/` (see Script Conventions below):
   ```bash
   vim templates/my-template/scripts/10_install-tools.sh
   chmod +x templates/my-template/scripts/10_install-tools.sh
   ```

4. **Add files to push** in `files/` using `USER` as a placeholder:
   ```bash
   mkdir -p templates/my-template/files/home/USER/.config
   vim templates/my-template/files/home/USER/.bashrc
   ```

5. **Add hooks** if you need lifecycle actions (optional):
   ```bash
   vim templates/my-template/hooks/pre-deploy.sh   # runs on host
   vim templates/my-template/hooks/post-deploy.sh  # runs in container
   chmod +x templates/my-template/hooks/*.sh
   ```

6. **Deploy:**
   ```bash
   ./templates/engine/deploy.sh my-template --dry-run  # preview first
   ./templates/engine/deploy.sh my-template --vmid 210
   ```

## template.yaml Reference

```yaml
name: my-template                    # Template identifier (string)
description: "What this does"        # Human-readable description
version: "1.0.0"                     # Semver template version

container:
  ostemplate: "local:vztmpl/..."     # Proxmox OS template path
  hostname: "my-container"           # Container hostname
  cores: 2                           # CPU cores (int)
  memory: 2048                       # RAM in MB (int)
  swap: 512                          # Swap in MB (int)
  disk: 8                            # Root disk size in GB (int)
  storage: "local-lvm"               # Proxmox storage ID
  network:
    bridge: "vmbr0"                  # Network bridge
    ip: "dhcp"                       # IP: "dhcp" or "192.168.1.10/24"
    gateway: ""                      # Gateway IP (empty = no gateway)
  dns:
    nameserver: ""                   # DNS nameserver (empty = host default)
    searchdomain: ""                 # DNS search domain
  unprivileged: true                 # Unprivileged container (recommended)
  features:                          # LXC features (list of strings)
    - nesting=1                      # Required for Docker-in-LXC
    - keyctl=1                       # Required for some systemd services
  tags:                              # Proxmox tags (list of strings)
    - dev

user:
  name: coder                        # Non-root username to create
  uid: 1000                          # User UID
  shell: /bin/bash                   # Login shell
  sudo: true                         # Grant NOPASSWD sudo

packages:
  apt:                               # apt-get packages (list of strings)
    - curl
    - git
  npm:                               # npm global packages (run as user)
    - pnpm@latest
  pip:                               # pipx packages (run as user)
    - semgrep
  cargo:                             # cargo install packages (run as user)
    - ripgrep
  go:                                # go install packages (run as user)
    - github.com/user/tool@latest

scripts_dir: scripts/                # Relative path to scripts directory
files_dir: files/                    # Relative path to files directory

hooks:
  pre_deploy: hooks/pre-deploy.sh    # Runs on HOST before container creation
  post_deploy: hooks/post-deploy.sh  # Runs INSIDE container after all scripts

env:                                 # Environment variables for scripts and profile
  LANG: "en_US.UTF-8"
  NPM_CONFIG_PREFIX: "/home/USER/.npm-global"  # USER is replaced with username
  PATH_APPEND:                       # Directories appended to PATH in .profile
    - "/home/USER/.local/bin"
    - "/home/USER/.cargo/bin"
```

**All fields are optional** except those needed for a working container (ostemplate, storage). The engine uses sensible defaults for everything else.

## Script Conventions

Scripts in `scripts/` run **inside the container** as `root` via `pct exec`. Follow these conventions:

1. **Numbered prefix for execution order** — `00_` through `99_`. Lower numbers run first.
   ```
   00_base.sh       # Base system setup
   01_create-user.sh
   10_node.sh       # Language runtimes
   20_foundry.sh    # Application tools
   99_verify.sh     # Verification (always last)
   ```

2. **Idempotency** — guard each script so re-running is safe:
   ```bash
   # Idempotency guard example
   if command -v node &>/dev/null && [[ "$(node --version)" == v22.* ]]; then
       echo "[10_node] Node.js 22 already installed, skipping"
       exit 0
   fi
   ```

3. **Environment variables available:**
   ```bash
   USERNAME      # Non-root username from template.yaml (e.g. "coder")
   USER_SHELL    # Login shell (e.g. "/bin/zsh")
   CTID          # Container ID
   LANG, LC_ALL  # Plus all variables from the template's env: block
   ```

4. **Use `set -euo pipefail`** — fail fast on errors.

5. **Run as root; use `su - $USERNAME -c` for user-level operations:**
   ```bash
   # Install user-level tool
   su - "$USERNAME" -c "curl https://foundry.paradigm.xyz | bash"
   ```

6. **Log with a prefix** for easy debugging:
   ```bash
   echo "[10_node] Installing Node.js 22..."
   ```

## Engine Architecture

The engine is composed of 6 library modules in `engine/lib/`:

| Module | Purpose |
|--------|---------|
| `logging.sh` | Colored log functions: `log_info`, `log_warn`, `log_error`, `log_debug`, `log_step`, `log_success` |
| `config.sh` | yq-based YAML reader: `cfg_get`, `cfg_get_default`, `cfg_get_array`, `cfg_get_packages`, `cfg_get_env` |
| `state.sh` | Deploy state file management: `state_init`, `state_get`, `state_set`, `state_mark_done`, `state_is_done` |
| `container.sh` | `pct` wrappers: `ct_create`, `ct_start`, `ct_exec`, `ct_exec_user`, `ct_push`, `ct_stop`, `ct_destroy` |
| `files.sh` | File push with `USER` placeholder replacement: `push_template_files` |
| `hooks.sh` | Lifecycle hooks: `run_hook_host` (pre-deploy on host), `run_hook_container` (post-deploy in container) |

`deploy.sh` sources all 6 modules and orchestrates the 11-phase pipeline:

```
Phase 1:  Pre-flight (validate inputs, check existing container)
Phase 2:  Pre-deploy hook (runs on Proxmox HOST)
Phase 3:  pct create (create the container)
Phase 4:  pct start + wait (start and stabilize)
Phase 5:  apt packages (install system packages)
Phase 6:  Push files (files/ directory with USER replacement)
Phase 7:  Run scripts (numbered scripts in execution order)
Phase 8:  User-level packages (pip/npm/cargo/go — run as user)
Phase 9:  Set environment (PATH_APPEND, env vars → .profile)
Phase 10: Post-deploy hook (runs INSIDE container)
Phase 11: Summary (print connection info and elapsed time)
```

## Resume and Recovery

If deployment fails mid-way, the engine saves progress to `.deploy-state` in the template directory. To resume from the last completed script:

```bash
./templates/engine/deploy.sh forge-shield --resume
```

The state file tracks:
- `CTID` — container ID being deployed
- `PHASE` — current deployment phase
- `COMPLETED_SCRIPTS` — comma-separated list of scripts that ran successfully
- `STATUS` — `running`, `complete`, or `failed`
- `FAILED_SCRIPT` — which script failed (when STATUS=failed)

The state file is automatically deleted on successful completion. If deployment fails, it persists so `--resume` can pick up where it left off.

**Note:** Do NOT delete a failed container before resolving the issue — the engine preserves the container for debugging. Use `--destroy` to tear it down when ready to retry from scratch.

## Available Templates

### forge-shield

**Full-stack + EVM development environment with security tooling**

Installs: Node.js 22, Python 3 + pipx, Go, Rust, Foundry suite, solc-select, Claude Code, OpenCode, GSD workflow, Semgrep, Trivy, Gitleaks, Slither, Aderyn, Echidna, Mythril, ZAP

```bash
./templates/engine/deploy.sh forge-shield --vmid 200
```

Includes Claude slash commands: `/security-gate`, `/audit-solidity`

### minimal

**Minimal starting-point template — copy this to create a new template**

Installs: curl, wget, git, vim (from apt)

```bash
./templates/engine/deploy.sh minimal --vmid 201
```
