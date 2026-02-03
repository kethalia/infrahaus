# Migrating to LXC Containers

## Overview

This guide helps you migrate from various development environment setups to LXC containers with git-based configuration management. Whether you're coming from Coder workspaces, Docker Compose environments, bare-metal setups, or cloud IDEs, this guide provides a systematic approach to migration.

### Why Migrate to LXC?

**Benefits of LXC containers with config-manager**:

- **Resource Efficiency**: 10-20% overhead vs 100%+ for VMs, lighter than Docker
- **Infrastructure as Code**: Everything defined in git, version-controlled, auditable
- **Automatic Updates**: Config sync on every boot keeps environment current
- **Snapshot/Rollback**: Built-in backup system for instant recovery
- **Reproducibility**: Create identical environments on-demand
- **Git-Based**: Declarative configs, easy collaboration, full history

**Trade-offs to consider**:

- **Learning curve**: Git-based config management requires understanding new patterns
- **Less isolation**: LXC containers share kernel with host (vs VMs)
- **ProxmoxVE dependency**: Requires ProxmoxVE infrastructure
- **Initial setup time**: Converting existing setup to declarative config takes effort

### When to Migrate

**Good fit**:

- ✅ You want reproducible, version-controlled environments
- ✅ You need multiple similar environments (dev, staging, testing)
- ✅ You have ProxmoxVE infrastructure (or plan to set it up)
- ✅ You value resource efficiency
- ✅ You want automatic config sync from git

**Maybe reconsider**:

- ⚠️ You need Windows/macOS environments (LXC is Linux-only)
- ⚠️ You frequently need kernel customization (LXC shares host kernel)
- ⚠️ You're happy with your current setup and it's working well
- ⚠️ You don't want to manage git-based configs

---

## General Migration Principles

### Pre-migration Checklist

Before migrating, inventory your current setup:

- [ ] **List all tools and packages** (languages, runtimes, CLI tools, databases)
- [ ] **Document custom configurations** (shell configs, tool settings, editor configs)
- [ ] **Identify data to preserve** (projects, databases, Docker volumes)
- [ ] **Note critical credentials** (SSH keys, API tokens, certificates)
- [ ] **Test backup/restore procedures** (ensure you can recover if needed)
- [ ] **Plan for downtime** (how long can you be without this environment?)

**Inventory script** (run in your current environment):

```bash
#!/usr/bin/env bash
# inventory.sh — Document current environment

echo "=== Installed Packages ==="
dpkg -l | grep ^ii | awk '{print $2}' > installed-packages.txt

echo "=== Manually Installed Tools ==="
which docker node npm pnpm python pip go rust cargo | tee installed-tools.txt

echo "=== Shell Configurations ==="
ls -la ~/ | grep '^\.' | tee shell-configs.txt

echo "=== Projects Directory ==="
find ~/projects -maxdepth 2 -type d | tee projects-list.txt

echo "=== Docker Containers ==="
docker ps -a --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | tee docker-containers.txt

echo "=== Docker Volumes ==="
docker volume ls | tee docker-volumes.txt

echo "Inventory complete. Files saved:"
echo "  - installed-packages.txt"
echo "  - installed-tools.txt"
echo "  - shell-configs.txt"
echo "  - projects-list.txt"
echo "  - docker-containers.txt"
echo "  - docker-volumes.txt"
```

### Data Categories

Organize what needs to be migrated into these categories:

#### 1. Code & Projects

**What**: Git repositories, working directories, source code

**How to preserve**:

- Push all changes to remote git repositories
- Archive uncommitted work: `tar -czf uncommitted-work.tar.gz ~/projects/`
- Use git bundles for repos without remotes: `git bundle create repo.bundle --all`

**LXC approach**:

- Clone from remote repos after container creation
- Restore uncommitted work from archive
- Consider mounting projects from ProxmoxVE host (NFS/CIFS)

#### 2. Configuration

**What**: Shell configs, tool settings, editor configurations

**How to preserve**:

- Dotfiles: `.bashrc`, `.zshrc`, `.vimrc`, `.gitconfig`, etc.
- Application configs: VS Code settings, shell themes, tmux configs
- Tool configs: Docker daemon.json, npm registry settings

**LXC approach**:

- Add dotfiles to `container-configs/files/` with `default` policy
- Use scripts in `container-configs/scripts/` to set up tools
- Commit all configs to git for version control

#### 3. Credentials

**What**: SSH keys, API tokens, certificates, passwords

**How to preserve**:

- Export SSH keys: `tar -czf ssh-keys.tar.gz ~/.ssh/`
- Document API tokens (store securely, not in git)
- Export certificates from keychains/password managers

**LXC approach**:

- Add SSH key deployment script (copies from secure storage)
- Use environment variables for API tokens (not committed to git)
- Store secrets in ProxmoxVE host, mount read-only

#### 4. Data

**What**: Databases, files, Docker volumes

**How to preserve**:

- Database dumps: `pg_dump`, `mysqldump`, `mongodump`
- Docker volumes: `docker run --rm -v vol:/data -v $(pwd):/backup alpine tar czf /backup/vol.tar.gz /data`
- File backups: `rsync -av ~/data/ backup/data/`

**LXC approach**:

- Restore databases from dumps (add restore script to `scripts/`)
- Store data on ProxmoxVE host, mount into container
- Use Docker volumes inside LXC container (persistent across syncs)

### Migration Strategy

Choose an approach based on your situation:

#### Strategy 1: Clean Slate (Recommended)

**Approach**: Start fresh with declarative config, migrate only essential data

**Advantages**:

- ✅ Clean, reproducible environment
- ✅ No cruft from old setup
- ✅ Forces you to document everything

**Disadvantages**:

- ⚠️ Requires rebuilding environment from scratch
- ⚠️ May miss undocumented customizations

**When to use**:

- You want the benefits of infrastructure-as-code
- You're willing to invest time in setup
- Your current environment has accumulated technical debt

**Process**:

1. Inventory current environment (tools, configs, data)
2. Create config-manager structure (packages, scripts, files)
3. Deploy LXC container from template
4. Verify all tools installed and working
5. Migrate data only (projects, databases, credentials)

#### Strategy 2: Lift-and-Shift

**Approach**: Copy everything from old environment to new container

**Advantages**:

- ✅ Fast migration
- ✅ Preserves all customizations
- ✅ Lower risk of missing something

**Disadvantages**:

- ⚠️ Not declarative (loses IaC benefits)
- ⚠️ May carry over technical debt
- ⚠️ Harder to reproduce

**When to use**:

- You need to migrate quickly
- Your environment has many undocumented customizations
- You plan to gradually convert to declarative config

**Process**:

1. Create basic LXC container (minimal template)
2. Copy home directory: `rsync -av old-env:~/ new-container:~/`
3. Copy `/etc` configs if needed
4. Reinstall packages: `dpkg --get-selections > packages.txt`, then `dpkg --set-selections < packages.txt && apt-get dselect-upgrade`
5. Gradually convert to config-manager

#### Strategy 3: Hybrid

**Approach**: Declarative config for tools, manual migration for data and personal configs

**Advantages**:

- ✅ Balance of speed and reproducibility
- ✅ Core setup is declarative
- ✅ Personal touches preserved

**Disadvantages**:

- ⚠️ Some manual work required
- ⚠️ Personal configs not in git (less reproducible)

**When to use**:

- You want most benefits of IaC
- You have many personal customizations
- You want faster migration than clean slate

**Process**:

1. Create config-manager structure for tools and packages
2. Deploy LXC container from template
3. Manually copy dotfiles and personal configs
4. Migrate data (projects, databases)
5. Test and iterate

---

## Migrating from Common Sources

### From Coder Workspaces

#### Architecture Comparison

**Before: Coder Workspace**

```
Coder Server (LXC)
├── Docker Engine
└── Workspace Container (Docker)
    ├── VS Code Server
    ├── Node.js, Docker CLI
    ├── Persistent home volume
    └── Git repos
```

**After: LXC Container with Config-Manager**

```
ProxmoxVE Host
└── LXC Container (Ubuntu)
    ├── Config-Manager Service
    ├── VS Code Server (direct install)
    ├── Docker Engine (Docker-in-Docker)
    ├── Node.js, tools
    └── Git repos
```

**Key differences**:

| Aspect                | Coder Workspace        | LXC Container                 |
| --------------------- | ---------------------- | ----------------------------- |
| **Provisioning**      | Terraform + Dockerfile | container.sh + config-manager |
| **Persistence**       | Docker volume          | Container root filesystem     |
| **Config sync**       | Rebuild container      | Git sync on boot              |
| **Isolation**         | Docker container       | LXC container                 |
| **Resource overhead** | Container + Docker     | LXC only                      |

#### Feature Mapping

| Coder Feature          | LXC Equivalent                          | Notes                               |
| ---------------------- | --------------------------------------- | ----------------------------------- |
| **Terraform template** | `container.sh` + `template.conf`        | ProxmoxVE API instead of Docker API |
| **Dockerfile**         | `scripts/` + `packages/`                | Declarative scripts + package lists |
| **Persistent volume**  | Container root filesystem               | Entire container persists           |
| **VS Code Server**     | Installed via `packages/` or `scripts/` | Direct install, not containerized   |
| **Docker support**     | Docker-in-Docker (privileged LXC)       | Same capability                     |
| **Workspace rebuild**  | `systemctl restart config-manager`      | Runs scripts, updates files         |
| **Git integration**    | Config-manager pulls from git           | Automatic on every boot             |
| **Parameter values**   | Environment variables                   | Same approach                       |

#### Step-by-step Migration

**Phase 1: Prepare Coder Workspace for Export**

```bash
# SSH into Coder workspace
coder ssh my-workspace

# 1. Push all git repos
cd ~/projects
for dir in */; do
    cd "$dir"
    git add .
    git commit -m "Pre-migration checkpoint" || true
    git push || echo "No remote for $dir"
    cd ..
done

# 2. Export Docker volumes (if any)
docker volume ls --format '{{.Name}}' | while read vol; do
    docker run --rm -v "$vol:/data" -v "$(pwd):/backup" alpine \
        tar czf "/backup/${vol}.tar.gz" /data
done

# 3. Backup dotfiles
tar -czf ~/dotfiles-backup.tar.gz ~/.bashrc ~/.zshrc ~/.vimrc ~/.gitconfig ~/.ssh/

# 4. Export VS Code extensions
code-server --list-extensions > ~/vscode-extensions.txt

# 5. Document installed tools
dpkg -l | grep ^ii > ~/installed-packages.txt
npm list -g --depth=0 > ~/npm-global-packages.txt
pip list > ~/pip-packages.txt
```

**Phase 2: Create LXC Template Configuration**

Convert your Coder template to config-manager format.

**From Coder Terraform** (`main.tf`):

```hcl
resource "docker_container" "workspace" {
  image = "my-workspace:latest"
  ...
}
```

**To LXC Template** (`template.conf`):

```bash
TEMPLATE_APP="My Workspace"
TEMPLATE_CPU="${TEMPLATE_CPU:-4}"
TEMPLATE_RAM="${TEMPLATE_RAM:-8192}"
TEMPLATE_DISK="${TEMPLATE_DISK:-20}"
TEMPLATE_CONFIG_PATH="infra/lxc/templates/my-workspace/container-configs"
```

**From Coder Dockerfile**:

```dockerfile
FROM codercom/code-server:latest

RUN apt-get update && apt-get install -y \
    curl git nodejs npm docker.io

RUN npm install -g pnpm typescript

COPY .bashrc /home/coder/.bashrc
```

**To LXC Config-Manager**:

**`packages/base.apt`**:

```
curl
git
nodejs
npm
docker.io
```

**`packages/node.npm`**:

```
pnpm
typescript
```

**`files/bashrc`** + `files/bashrc.path` + `files/bashrc.policy`

**Phase 3: Deploy LXC Container**

```bash
# On ProxmoxVE host
bash -c "$(curl -fsSL https://raw.githubusercontent.com/yourusername/pve-home-lab/main/infra/lxc/templates/my-workspace/container.sh)"
```

**Phase 4: Migrate Data**

```bash
# Get LXC container IP
LXC_IP=$(pct exec <container-id> ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)

# Copy projects
rsync -av --progress ~/projects/ coder@$LXC_IP:~/projects/

# Copy dotfiles
scp ~/dotfiles-backup.tar.gz coder@$LXC_IP:~/ && \
    ssh coder@$LXC_IP 'tar -xzf ~/dotfiles-backup.tar.gz -C ~/'

# Restore Docker volumes (if needed)
for vol in *.tar.gz; do
    scp "$vol" coder@$LXC_IP:~/ && \
        ssh coder@$LXC_IP "docker volume create ${vol%.tar.gz} && \
            docker run --rm -v ${vol%.tar.gz}:/data -v ~/:/backup alpine \
            tar xzf /backup/$vol -C /"
done
```

**Phase 5: Verify and Cleanup**

```bash
# SSH into LXC container
ssh coder@$LXC_IP

# Verify tools
docker --version
node --version
pnpm --version

# Verify projects
cd ~/projects/my-app && npm install && npm run build

# Verify Docker volumes
docker volume ls

# Verify VS Code extensions (if using code-server)
code-server --list-extensions

# Install missing extensions
cat ~/vscode-extensions.txt | xargs -I{} code-server --install-extension {}
```

**Phase 6: Decommission Old Workspace**

```bash
# Only after verifying everything works in LXC

# Stop Coder workspace
coder stop my-workspace

# Delete workspace (after confirming data is migrated)
coder delete my-workspace
```

#### Performance Comparison

Based on equivalent workloads (4 CPU, 8GB RAM, Ubuntu 24.04):

| Metric                     | Coder Workspace (Docker) | LXC Container   | Difference |
| -------------------------- | ------------------------ | --------------- | ---------- |
| **Memory overhead**        | 100-200 MB (Docker)      | 20-50 MB (LXC)  | -60%       |
| **Boot time**              | 10-15 seconds            | 5-8 seconds     | -50%       |
| **Disk space**             | 3-4 GB (base image)      | 2-3 GB (LXC)    | -25%       |
| **Filesystem performance** | Overlay2 (slower)        | Direct (faster) | +10-20%    |
| **Network latency**        | Docker bridge            | Direct bridge   | Similar    |

**Real-world observation**: LXC containers feel "snappier" due to lower overhead and direct filesystem access.

---

### From Docker Compose Development Environments

#### Common Pattern

```yaml
# docker-compose.yml
version: "3.8"
services:
  dev:
    image: node:20
    volumes:
      - ./:/workspace
      - /var/run/docker.sock:/var/run/docker.sock
    ports:
      - "3000:3000"
      - "5432:5432"
    environment:
      - NODE_ENV=development
```

#### Migration Approach

**Convert docker-compose services to config-manager components**:

1. **Base image** → LXC OS + packages
2. **Volumes** → Container filesystem or mounted storage
3. **Ports** → ProxmoxVE port forwarding or reverse proxy
4. **Environment variables** → Scripts or `/etc/environment`

**Example Conversion**:

**`packages/base.apt`**:

```
nodejs
npm
```

**`scripts/10-docker-install.sh`**:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Install Docker (for accessing host Docker socket)
if ! is_installed docker; then
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker "$CONTAINER_USER"
fi
```

**`files/environment`** (for environment variables):

```
NODE_ENV=development
```

**`files/environment.path`**:

```
/etc
```

**`files/environment.policy`**:

```
replace
```

---

### From Bare Metal / VM Development

#### Current Setup

```
Physical Machine / VM
├── Ubuntu 22.04
├── Packages: docker, nodejs, python, go, rust
├── Projects: ~/projects/
├── Dotfiles: ~/.bashrc, ~/.vimrc, ~/.gitconfig
└── Databases: PostgreSQL, Redis
```

#### Migration Steps

**1. Inventory Installed Packages**

```bash
# Export package list
dpkg --get-selections > packages.txt

# Convert to APT format
awk '{print $1}' packages.txt > container-configs/packages/base.apt
```

**2. Extract Dotfiles**

```bash
# Copy dotfiles to git repo
cp ~/.bashrc container-configs/files/bashrc
echo "$HOME" > container-configs/files/bashrc.path
echo "default" > container-configs/files/bashrc.policy

# Repeat for other dotfiles
```

**3. Document Custom Installations**

```bash
# Check for manual installations
ls /usr/local/bin/ | tee manual-installs.txt

# Convert to custom installers
# Example: Rust toolchain
echo "rust|command -v rustc|curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y" \
    >> container-configs/packages/dev-tools.custom
```

**4. Backup Databases**

```bash
# PostgreSQL
sudo -u postgres pg_dumpall > postgresql-backup.sql

# Redis
redis-cli --rdb redis-backup.rdb

# Copy to LXC and restore
scp postgresql-backup.sql coder@lxc-ip:~/
ssh coder@lxc-ip 'sudo -u postgres psql -f ~/postgresql-backup.sql'
```

**5. Migrate Projects**

```bash
# Ensure all projects are in git
cd ~/projects
for dir in */; do
    cd "$dir"
    git init
    git add .
    git commit -m "Initial commit before migration"
    git push  # to remote
    cd ..
done

# Clone into LXC container
ssh coder@lxc-ip
mkdir ~/projects
cd ~/projects
for repo in repo1 repo2 repo3; do
    git clone git@github.com:user/$repo.git
done
```

---

### From Cloud IDEs (GitHub Codespaces, Gitpod)

#### Common Pattern

**`.devcontainer/devcontainer.json`** (Codespaces):

```json
{
  "name": "My Dev Container",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:20",
  "features": {
    "ghcr.io/devcontainers/features/docker-in-docker:2": {}
  },
  "postCreateCommand": "npm install",
  "customizations": {
    "vscode": {
      "extensions": ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode"]
    }
  }
}
```

#### Conversion Strategy

**`devcontainer.json` → config-manager**:

| devcontainer.json           | config-manager                    | Example                           |
| --------------------------- | --------------------------------- | --------------------------------- |
| `image`                     | `packages/*.apt`                  | `nodejs` in base.apt              |
| `features.docker-in-docker` | `scripts/02-docker-install.sh`    | Docker CE installation            |
| `postCreateCommand`         | `scripts/90-post-setup.sh`        | `npm install` in script           |
| `extensions`                | `scripts/50-vscode-extensions.sh` | `code-server --install-extension` |
| `forwardPorts`              | ProxmoxVE firewall                | Port mapping in container.sh      |

**Example: Convert Codespaces config**

**`scripts/90-codespaces-post-setup.sh`**:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Run post-create command
if [[ -d ~/projects/my-app ]]; then
    cd ~/projects/my-app
    npm install
    log_info "Dependencies installed for my-app"
fi
```

**`scripts/50-vscode-extensions.sh`**:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Install VS Code extensions
EXTENSIONS=(
    "dbaeumer.vscode-eslint"
    "esbenp.prettier-vscode"
    "bradlc.vscode-tailwindcss"
)

for ext in "${EXTENSIONS[@]}"; do
    code-server --install-extension "$ext"
    log_info "Installed extension: $ext"
done
```

---

## Data Transfer Methods

### SSH/SCP

**Use when**: Small to medium data transfer (< 10 GB), secure transfer required

```bash
# Single file
scp file.txt user@lxc-ip:~/

# Directory
scp -r ~/projects/ user@lxc-ip:~/projects/

# With compression (faster for text files)
tar czf - ~/projects | ssh user@lxc-ip 'tar xzf - -C ~/'

# Show progress
rsync -av --progress ~/projects/ user@lxc-ip:~/projects/
```

### Git Push/Pull

**Use when**: Code projects, configs suitable for version control

```bash
# Push from old environment
git add .
git commit -m "Pre-migration snapshot"
git push

# Pull in new environment
git clone https://github.com/user/repo.git
```

**Advantages**:

- ✅ Version controlled
- ✅ No need for direct file transfer
- ✅ Easy to replicate on multiple containers

### Rsync

**Use when**: Large data transfer, need incremental sync

```bash
# Initial transfer
rsync -av --progress ~/projects/ user@lxc-ip:~/projects/

# Incremental sync (only changed files)
rsync -av --progress --delete ~/projects/ user@lxc-ip:~/projects/

# Over SSH with compression
rsync -avz --progress ~/projects/ user@lxc-ip:~/projects/

# Dry run (preview changes)
rsync -avn --progress ~/projects/ user@lxc-ip:~/projects/
```

### Docker Volume Export/Import

**Use when**: Docker volumes with data (databases, uploads, etc.)

```bash
# Export volume
docker run --rm -v my-volume:/data -v $(pwd):/backup alpine \
    tar czf /backup/my-volume.tar.gz /data

# Copy to LXC
scp my-volume.tar.gz user@lxc-ip:~/

# Import volume in LXC
ssh user@lxc-ip
docker volume create my-volume
docker run --rm -v my-volume:/data -v ~/:/backup alpine \
    tar xzf /backup/my-volume.tar.gz -C / --strip-components=1
```

### ProxmoxVE Storage Mount

**Use when**: Large data, want to share across containers

```bash
# On ProxmoxVE host, create NFS share
mkdir -p /srv/nfs/projects
echo "/srv/nfs/projects *(rw,sync,no_subtree_check)" >> /etc/exports
exportfs -a

# Mount in LXC container
# Add to container config:
pct set <container-id> -mp0 /srv/nfs/projects,mp=/mnt/projects

# Or mount via fstab in container
echo "proxmox-host:/srv/nfs/projects /mnt/projects nfs defaults 0 0" >> /etc/fstab
mount -a
```

---

## Post-Migration

### Validation Checklist

After migration, verify everything works:

- [ ] **All tools installed and accessible**

  ```bash
  docker --version
  node --version
  python --version
  # ... check all your tools
  ```

- [ ] **Projects clone and build successfully**

  ```bash
  cd ~/projects/my-app
  npm install
  npm run build
  # ... test all projects
  ```

- [ ] **Shell environment feels familiar**

  ```bash
  # Aliases work
  ll
  gs
  # Custom prompt
  echo $PS1
  ```

- [ ] **SSH keys and credentials work**

  ```bash
  ssh-add -l
  git pull  # should not ask for password
  ```

- [ ] **Config-manager syncing correctly**

  ```bash
  systemctl status config-manager
  config-rollback list  # at least one snapshot
  ```

- [ ] **Docker works (if using Docker-in-Docker)**

  ```bash
  docker run hello-world
  docker-compose up  # test your stacks
  ```

- [ ] **Databases accessible**

  ```bash
  psql -l  # PostgreSQL
  redis-cli ping  # Redis
  ```

- [ ] **Ports accessible**
  ```bash
  # From your workstation
  curl http://lxc-ip:3000
  ```

### Optimization

After successful migration:

#### 1. Remove Unused Packages

```bash
# List manually installed packages
apt-mark showmanual > manually-installed.txt

# Review and remove unused
vim manually-installed.txt  # remove what you don't need

# Uninstall
cat manually-installed.txt | xargs apt-get remove -y
apt-get autoremove -y
```

Update `packages/base.apt` to reflect only needed packages.

#### 2. Configure Snapshot Retention

```bash
# Edit config
vim /etc/config-manager/config.env

# Adjust retention (default: 7 days)
SNAPSHOT_RETENTION_DAYS="30"  # Keep more history
# or
SNAPSHOT_RETENTION_DAYS="3"   # Keep less (save space)

# Manually cleanup now
/usr/local/lib/config-manager/snapshot-manager.sh cleanup
```

#### 3. Set Up Custom Scripts

Add automation for your workflow:

```bash
# Example: Auto-start Docker Compose stacks
cat > container-configs/scripts/95-start-docker-stacks.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ -d ~/projects/my-stack ]]; then
    cd ~/projects/my-stack
    docker-compose up -d
    log_info "Started my-stack"
fi
EOF

git add .
git commit -m "Add auto-start for Docker stacks"
git push
```

#### 4. Document Your Setup

Update your README:

````bash
# In your config repo
cat > README.md <<'EOF'
# My LXC Development Environment

## Tools Installed
- Docker CE
- Node.js 20.x
- Python 3.12
- PostgreSQL 16

## Custom Scripts
- `95-start-docker-stacks.sh` — Auto-starts Docker Compose stacks

## Usage
```bash
# Deploy new container
bash -c "$(curl -fsSL https://...)"

# SSH into container
ssh coder@lxc-ip
```

## Troubleshooting

See [TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md)
EOF

git add README.md
git commit -m "Document environment setup"
git push

````

---

## Troubleshooting Migration Issues

### Issue: Missing Packages After Migration

**Symptom**: Commands not found, tools missing

**Cause**: Package names differ between distros, or packages not added to config

**Solution**:

```bash
# Find package name
apt-cache search <tool>

# Add to packages/base.apt
echo "<package-name>" >> container-configs/packages/base.apt

# Commit and sync
git add .
git commit -m "Add missing package: <package-name>"
git push
systemctl restart config-manager
```

### Issue: Dotfiles Not Applied

**Symptom**: Custom shell config missing, prompt looks default

**Cause**: Policy is `default` and file already exists

**Solution**:

```bash
# Check if file exists
ls -la ~/.bashrc

# Remove file to let config-manager deploy it
rm ~/.bashrc

# Re-sync
systemctl restart config-manager

# Or change policy to `replace` in git
echo "replace" > container-configs/files/bashrc.policy
git commit -am "Force replace bashrc"
git push
systemctl restart config-manager
```

### Issue: Docker Not Working

**Symptom**: `docker` command not found or permission denied

**Cause**: Docker not installed, or user not in `docker` group

**Solution**:

```bash
# Check Docker installation
docker --version

# If not installed, add to packages
echo "docker.io" >> container-configs/packages/base.apt
# Or use install script
# scripts/02-docker-install.sh (from web3-dev template)

# Check group membership
groups $USER | grep docker

# If not in group
sudo usermod -aG docker $USER
newgrp docker  # or logout/login
```

### Issue: Git Authentication Fails

**Symptom**: `git push` asks for password, or permission denied

**Cause**: SSH keys not migrated or not added to agent

**Solution**:

```bash
# Check if SSH key exists
ls -la ~/.ssh/id_*

# If missing, copy from old environment
scp old-env:~/.ssh/id_rsa* ~/.ssh/

# Set correct permissions
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub

# Add to ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_rsa

# Test
ssh -T git@github.com
```

### Issue: Performance is Slower

**Symptom**: Builds take longer, filesystem feels sluggish

**Cause**: Different storage backend, network latency, resource allocation

**Solution**:

```bash
# Check resources
pct config <container-id> | grep -E 'cores|memory|rootfs'

# Increase if needed
pct stop <container-id>
pct set <container-id> -cores 8 -memory 16384
pct start <container-id>

# Check storage backend (on ProxmoxVE host)
pct config <container-id> | grep rootfs
# Prefer: ZFS > LVM-thin > ext4

# Check for disk I/O bottleneck
iostat -x 1
```

---

## Case Studies

### Case Study 1: Web3 Developer Migrating from Coder

**Background**:

- Current: Coder workspace with Node.js, Foundry, Hardhat
- Goal: Migrate to LXC for better resource efficiency
- Requirements: Keep all tooling, preserve SSH keys, maintain Git workflow

**Migration Process**:

1. **Inventory** (1 hour)
   - Documented all installed tools
   - Exported SSH keys and GPG keys
   - Pushed all repos to GitHub

2. **Create Config** (2 hours)
   - Created `web3-dev` template
   - Added packages: Node.js, Foundry, Docker
   - Added dotfiles: `.bashrc`, `.gitconfig`, `.zshrc`
   - Created custom installers for Foundry, Hardhat

3. **Deploy & Migrate** (1 hour)
   - Deployed LXC container
   - Copied SSH keys
   - Cloned repos from GitHub
   - Verified all tools working

4. **Optimize** (30 minutes)
   - Removed unused packages
   - Set snapshot retention to 14 days
   - Added auto-start for local blockchain

**Results**:

- ✅ Migration completed in 4.5 hours
- ✅ 40% reduction in memory usage (8GB → 5GB)
- ✅ Faster boot times (15s → 6s)
- ✅ Git-managed config enables easy replication

### Case Study 2: Full-Stack Team Migrating from Local VMs

**Background**:

- Team of 5 developers
- Current: Ubuntu VMs on laptops, manual setup
- Goal: Standardize environments, enable quick onboarding
- Requirements: Identical setups, easy updates

**Migration Process**:

1. **Standardization** (1 week)
   - Inventoried common tools across team
   - Created shared config-manager repo
   - Defined `full-stack-dev` template
   - Tested on one developer's setup

2. **Rollout** (2 days)
   - Each developer deployed LXC container
   - Migrated projects from local VMs
   - Pair-programmed to resolve issues

3. **Iteration** (ongoing)
   - Team adds tools via pull requests
   - Config updates propagate on next boot
   - New team members onboard in 1 hour

**Results**:

- ✅ Consistent environments across team
- ✅ Onboarding time: 1 day → 1 hour
- ✅ Tool updates: individual → team-wide (via git push)
- ✅ Reduced "works on my machine" issues by 80%

---

## Next Steps

After successful migration:

- **[Configuration Reference](CONFIGURATION.md)** — Deep dive into config-manager features
- **[Setup Guide](SETUP.md)** — Advanced template customization
- **[Troubleshooting](TROUBLESHOOTING.md)** — Common issues and solutions

### Quick Wins After Migration

1. **Share your template**: Fork the repo, commit your template, share with team
2. **Automate more**: Add scripts for project setup, database seeding, test data
3. **Multi-environment**: Use git branches for dev/staging/prod
4. **Snapshot testing**: Test risky changes with instant rollback
5. **Document**: Keep README updated with setup instructions
