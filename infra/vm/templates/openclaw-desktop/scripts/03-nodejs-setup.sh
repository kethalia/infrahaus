#!/usr/bin/env bash
# 03-nodejs-setup.sh — Node.js 22 via NodeSource with npm global prefix
#
# Installs Node.js 22 LTS using the NodeSource setup script.
# Configures npm global prefix for the openclaw user to avoid permission issues.
# Idempotent: skips install if Node.js 22 is already present.
#
# Usage: sudo ./03-nodejs-setup.sh

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

info "=== Setting Up Node.js 22 ==="

if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root. Try: sudo $0"
    exit 1
fi

# ---------------------------------------------------------------------------
# 1. Idempotency check — skip if Node.js 22 already installed
# ---------------------------------------------------------------------------
if node --version 2>/dev/null | grep -q '^v22\.'; then
    CURRENT_NODE=$(node --version)
    info "Node.js ${CURRENT_NODE} already installed — skipping NodeSource setup."
else
    info "Installing Node.js 22 via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
    info "Node.js installed."
fi

# ---------------------------------------------------------------------------
# 2. Verify installation
# ---------------------------------------------------------------------------
NODE_VER=$(node --version)
NPM_VER=$(npm --version)
info "Node.js: ${NODE_VER}"
info "npm:     v${NPM_VER}"

# ---------------------------------------------------------------------------
# 3. Configure npm global prefix for openclaw user
#    Avoids needing sudo for global npm installs (e.g. openclaw itself)
# ---------------------------------------------------------------------------
info "Configuring npm global prefix for openclaw user..."

sudo -u openclaw npm config set prefix /home/openclaw/.npm-global

# Add .npm-global/bin to PATH in .bashrc if not already present
if grep -q 'npm-global' /home/openclaw/.bashrc 2>/dev/null; then
    info "npm-global PATH already in /home/openclaw/.bashrc — skipping."
else
    echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> /home/openclaw/.bashrc
    info "Added npm-global PATH to /home/openclaw/.bashrc."
fi

# Also add to .profile for non-interactive shell sessions (systemd services, VNC startup)
if grep -q 'npm-global' /home/openclaw/.profile 2>/dev/null; then
    info "npm-global PATH already in /home/openclaw/.profile — skipping."
else
    echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> /home/openclaw/.profile
    info "Added npm-global PATH to /home/openclaw/.profile."
fi

chown openclaw:openclaw /home/openclaw/.bashrc /home/openclaw/.profile 2>/dev/null || true

info "=== Node.js Setup Complete ==="
info "  Node.js: ${NODE_VER}"
info "  npm:     v${NPM_VER}"
info "  Global prefix: /home/openclaw/.npm-global"
info ""
info "NOTE: openclaw user must re-source ~/.bashrc or log out/in to use npm global binaries."
