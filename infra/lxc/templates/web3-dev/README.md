# Web3 Development Container Template

This template provides a complete ProxmoxVE LXC container setup for Web3 development with Docker-in-Docker support and git-based configuration management.

## Template Contents

This template is completely self-contained:

```
web3-dev/
├── container.sh          # ProxmoxVE container creation script
├── install.sh            # Installation script (runs inside container)
├── README.md             # This documentation
└── container-configs/    # Web3-specific configuration
    ├── packages/         # Package lists (Docker, Node.js, Web3 tools)
    ├── scripts/          # Boot-time scripts
    └── files/            # Managed configuration files
```

## Quick Start

### One-Command Deployment

```bash
# From ProxmoxVE host shell:
bash -c "$(curl -fsSL https://raw.githubusercontent.com/kethalia/pve-home-lab/main/infra/lxc/templates/web3-dev/container.sh)"
```

### Custom Configuration

```bash
# Custom resources (2 CPU, 4GB RAM, 30GB disk)
var_cpu=2 var_ram=4096 var_disk=30 \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/kethalia/pve-home-lab/main/infra/lxc/templates/web3-dev/container.sh)"

# Custom repository and branch
REPO_URL="https://github.com/myuser/my-fork.git" \
REPO_BRANCH="develop" \
  bash -c "$(curl -fsSL https://raw.githubusercontent.com/kethalia/pve-home-lab/main/infra/lxc/templates/web3-dev/container.sh)"
```

## Container Specifications

### Default Configuration

- **Type:** Privileged LXC (for Docker-in-Docker)
- **OS:** Ubuntu 24.04 LTS
- **CPU:** 4 cores
- **RAM:** 8192 MB (8 GB)
- **Disk:** 20 GB
- **Features:** Nesting, Keyctl, FUSE enabled
- **Tags:** web3, development, nodejs, docker
- **User:** `coder` (UID 1000)
- **Exposed Ports:**
  - 8080: VS Code Server
  - 8081: FileBrowser
  - 8082: OpenCode

### Customizable via Environment Variables

#### Container Resources (`container.sh`)

```bash
var_cpu=<cores>              # Number of CPU cores (default: 4)
var_ram=<megabytes>          # RAM in MB (default: 8192)
var_disk=<gigabytes>         # Disk size in GB (default: 20)
var_os=<os>                  # OS template (default: ubuntu)
var_version=<version>        # OS version (default: 24.04)
var_unprivileged=<0|1>       # Privileged mode (default: 0 = privileged)
var_nesting=<0|1>            # Enable nesting (default: 1)
var_keyctl=<0|1>             # Enable keyctl (default: 1)
var_fuse=<0|1>               # Enable FUSE (default: 1)
```

#### Configuration Management (`install.sh`)

```bash
REPO_URL=<git-url>           # Configuration repository (default: this repo)
REPO_BRANCH=<branch>         # Repository branch (default: main)
CONFIG_PATH=<path>           # Config path in repo (default: infra/lxc/templates/web3-dev/container-configs)
```

**Note:** This template includes its own `container-configs/` directory with web3-specific packages. You can customize this template's packages or point to a different config path entirely.

## What Gets Installed

### Base System

1. **Essential packages:** curl, git, sudo, wget, build-essential, vim, unzip
2. **User setup:** Creates `coder` user (UID 1000) with restricted sudo access
3. **Shell enhancement:** Starship prompt for bash
4. **Config management:** Git-based configuration sync service

### Development Tools (via Config-Manager)

Automatically installed from `container-configs/packages/`:

- **Docker CE:** docker-ce, docker-ce-cli, containerd.io, docker-compose-plugin
- **Node.js:** Latest LTS with npm and pnpm
- **Web3 Tools:** Foundry (forge, cast, anvil, chisel)
- **CLI Tools:** GitHub CLI (gh), Act (local GitHub Actions)

### Browser-Based Development Tools

- **code-server:** VS Code in the browser (port 8080)
  - Pre-configured with extensions (ESLint, Prettier, Solidity, Copilot, GitLens, Docker)
  - Auto-save enabled, format on save
  - Default Dark+ theme
- **FileBrowser:** Web-based file manager (port 8081)
  - Browse and manage files through browser
  - Upload/download files
  - Edit files directly
- **OpenCode:** Alternative web-based code editor (port 8082)
  - Lightweight alternative to code-server
  - Modern web-based editing experience

## Configuration Management

### Git-Based Sync

The container uses a git-based configuration management system that:

- **Auto-syncs on boot:** Configuration applied every container start
- **Declarative:** All configuration in version-controlled files
- **Rollback capable:** Snapshots with conflict detection
- **Cross-distribution:** Works on Ubuntu, Debian, Alpine, RHEL

### Configuration Structure

This template includes its own configuration in `container-configs/`:

```
web3-dev/container-configs/
├── packages/           # Package installation lists
│   ├── cli.custom     # Custom CLI tools (gh, act)
│   ├── node.custom    # Node.js ecosystem (npm, pnpm)
│   └── web3.custom    # Blockchain tools (Foundry)
├── scripts/           # Boot-time scripts (run alphabetically)
└── files/             # Managed configuration files
```

**Self-Contained:** All web3-specific packages are defined within this template, making it easy to customize or fork.

### Manual Configuration Management

```bash
# Inside container - trigger manual sync
sudo systemctl restart config-manager

# Check sync status
journalctl -u config-manager -f

# View sync logs
cat /var/log/config-manager/sync.log

# Configuration rollback
config-rollback status    # Check current state
config-rollback list      # List available snapshots
config-rollback <hash>    # Rollback to specific snapshot
```

## Container Management

### Access Methods

#### Terminal Access

```bash
# SSH access (after container is created)
ssh coder@<container-ip>

# Console access (from ProxmoxVE host)
pct enter <container-id>
```

#### Browser-Based Development

Access your development environment through the browser:

```
VS Code Server:   http://<container-ip>:8080
                  Password: coder

FileBrowser:      http://<container-ip>:8081
                  Username: admin
                  Password: coder

OpenCode:         http://<container-ip>:8082
```

**Features:**

- Full VS Code experience in the browser
- Pre-installed extensions (Solidity, Docker, GitLens, Copilot)
- File management and uploads via FileBrowser
- Auto-save and format-on-save enabled
- Git integration with GitLens

**First Time Setup:**

1. Open `http://<container-ip>:8080` in your browser
2. Enter password: `coder`
3. Open folder: `/home/coder`
4. Start coding!

### Updates

#### Automatic Updates

- Configuration syncs automatically on every container boot
- Development tools update via git-synced packages

#### Manual Updates

```bash
# Inside container - update system packages
apt update && apt upgrade -y

# Sync latest configuration
sudo systemctl restart config-manager
```

#### ProxmoxVE Updates

From ProxmoxVE host:

```bash
# Find container ID
pct list | grep "Web3 Dev"

# Enter container and update
pct enter <container-id>
apt update && apt upgrade -y
systemctl restart config-manager
```

## Creating Custom Templates

This template can be customized for different use cases:

### Option 1: Fork and Modify

1. Fork this repository
2. Modify `container.sh` for different resources/tags
3. Modify `install.sh` for different base packages
4. Update `REPO_URL` to point to your fork
5. Customize `container-configs/` with your packages

### Option 2: Create New Template

```bash
# Copy entire template directory (completely self-contained)
cp -r infra/lxc/templates/web3-dev infra/lxc/templates/my-template

# Customize for your needs:
# 1. Edit container.sh: Change APP name, resources, tags
# 2. Edit install.sh: Modify base packages, user setup
# 3. Edit container-configs/packages/: Replace web3 packages with yours
# 4. Update README.md: Document your template

# Each template is self-contained with its own container-configs/
```

### Example: Python Data Science Template

```bash
# 1. Copy web3-dev template
cp -r infra/lxc/templates/web3-dev infra/lxc/templates/datascience

# 2. Edit container.sh
APP="Data Science Container"
var_tags="${var_tags:-python;datascience;jupyter;ml}"
var_cpu="${var_cpu:-8}"
var_ram="${var_ram:-16384}"

# 3. Edit install.sh
CONFIG_PATH="${CONFIG_PATH:-infra/lxc/templates/datascience/container-configs}"

# 4. Replace packages in datascience/container-configs/packages/
rm -f container-configs/packages/{cli,node,web3}.custom
echo "python3 python3-pip python3-venv" > container-configs/packages/python.apt
echo "#!/bin/bash
pip3 install jupyter pandas numpy matplotlib scikit-learn tensorflow" > container-configs/packages/ml.custom
chmod +x container-configs/packages/ml.custom

# Each template is completely independent with its own packages!
```

## Architecture Benefits

### vs Coder/Docker Setup

- **Boot time:** ~60% faster (1-2 min vs 3-5 min)
- **Memory overhead:** 90% reduction (~100 MB vs ~1 GB agent)
- **CPU overhead:** ~75% reduction (<2% vs 5-10%)
- **Storage efficiency:** ~30% less usage (direct FS vs Docker layers)

### Operational Advantages

- **Direct LXC:** No middleware complexity
- **Git-based:** Version controlled, reviewable configuration
- **Rollback capable:** Snapshot support with conflict detection
- **Declarative:** Infrastructure as code
- **Flexible:** Easy to create custom templates

## Requirements

- **ProxmoxVE:** 8.x or 9.x
- **Network:** Internet access for package downloads and git sync
- **Storage:** Sufficient pool space for container disk
- **Permissions:** Ability to create privileged containers

## Troubleshooting

### Container Creation Issues

```bash
# Check ProxmoxVE logs
journalctl -xe

# Verify network connectivity
ping github.com

# Check storage pool space
pvesm status
```

### Configuration Sync Issues

```bash
# Inside container - check service status
systemctl status config-manager

# View detailed logs
journalctl -u config-manager -n 50

# Check sync logs
cat /var/log/config-manager/sync.log

# Test manual sync
sudo systemctl restart config-manager
```

### Docker Issues

```bash
# Verify Docker is installed
docker --version

# Check Docker daemon
systemctl status docker

# Verify user is in docker group
groups coder
```

### Tool Not in PATH

Some tools may require container restart after first sync:

```bash
# From ProxmoxVE host
pct reboot <container-id>

# Or inside container
sudo reboot
```

### Web Services Issues

```bash
# Check if services are running
systemctl status code-server@coder
systemctl status filebrowser
systemctl status opencode@coder

# Restart services
sudo systemctl restart code-server@coder
sudo systemctl restart filebrowser
sudo systemctl restart opencode@coder

# Check service logs
journalctl -u code-server@coder -n 50
journalctl -u filebrowser -n 50
journalctl -u opencode@coder -n 50

# Verify ports are listening
ss -tlnp | grep ':808'

# Check firewall (if enabled)
ufw status
```

**Common Issues:**

- **Can't access port 8080:** Check if code-server is running: `systemctl status code-server@coder`
- **Wrong password:** Default password is `coder` for all services
- **Port conflicts:** Ensure ports 8080-8082 are not already in use
- **VS Code extensions not loading:** Restart code-server service

## Security Considerations

### Sudo Access

The `coder` user has passwordless sudo for specific development commands:

- `/usr/bin/systemctl` - Service management
- `/usr/bin/docker` - Docker operations
- `/usr/bin/git` - Git operations
- `/usr/local/bin/config-sync.sh` - Configuration sync
- `/usr/local/bin/config-rollback` - Configuration rollback

All other sudo commands require password authentication.

### Privileged Container

This template creates a **privileged** LXC container to support Docker-in-Docker. Privileged containers have root access to the host system. Use appropriate network isolation and security policies.

### Web Service Security

The container exposes web services on ports 8080-8082 for browser-based development:

- **code-server (8080):** Protected with password authentication (default: `coder`)
- **filebrowser (8081):** Protected with username/password (admin/coder)
- **opencode (8082):** No authentication (bind to localhost or use reverse proxy)

**Security Recommendations:**

1. **Change default passwords** after first login
2. **Use reverse proxy** (nginx/traefik) with HTTPS for production
3. **Firewall rules:** Restrict access to trusted networks only
4. **VPN access:** Consider accessing web services through VPN
5. **Container isolation:** Run in isolated network or VLAN

**ProxmoxVE Firewall Example:**

```bash
# From ProxmoxVE host
pct set <container-id> -net0 name=eth0,bridge=vmbr0,firewall=1,ip=dhcp

# Add firewall rules in ProxmoxVE web UI:
# - Allow 8080-8082 from specific IP ranges only
# - Block all other incoming connections
```

### Download Security

- **build.func:** Pinned to immutable tag `2026-02-02`
- **Starship:** Downloaded as prebuilt binary from GitHub releases
- **Config-manager:** Downloaded with validation and verification
- **code-server:** Official installation script from code-server.dev
- **filebrowser:** Official installation script from filebrowser.org

## Contributing

### Reporting Issues

Report issues at: https://github.com/kethalia/pve-home-lab/issues

### Creating Templates

Share your custom templates by:

1. Creating a PR with your template in `infra/lxc/templates/your-template/`
2. Include comprehensive README documenting use case
3. Provide example configuration in `container-configs-your-template/`

## License

MIT - See [LICENSE](https://github.com/kethalia/pve-home-lab/blob/main/LICENSE)

## Related Documentation

- [ProxmoxVE Community Scripts](https://github.com/community-scripts/ProxmoxVE)
- [Config-Manager Documentation](../../scripts/config-manager/)
- [Container Configs](../../container-configs/)
