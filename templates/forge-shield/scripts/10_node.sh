#!/usr/bin/env bash
# 10_node.sh — Install Node.js 22 LTS via NodeSource
# Runs as root inside the container. USERNAME env var must be set.
set -euo pipefail

LOG_PREFIX="[10_node]"

log() { echo "${LOG_PREFIX} $*"; }

# Guard: skip if Node.js 22 is already installed
if command -v node &>/dev/null && [[ "$(node --version)" == v22.* ]]; then
  log "Node.js $(node --version) already installed, skipping."
  exit 0
fi

log "Installing Node.js 22 LTS via NodeSource..."

# Add NodeSource apt repository for Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -

# Install Node.js
apt-get install -y nodejs

# Verify installation
log "Installed: node $(node --version), npm $(npm --version)"

# Set up npm global directory for the non-root user to avoid installing packages as root
if [[ -z "${USERNAME:-}" ]]; then
  log "WARNING: USERNAME not set, skipping user npm-global setup."
else
  log "Configuring npm global directory for user '${USERNAME}'..."
  su - "${USERNAME}" -c "mkdir -p ~/.npm-global"
  su - "${USERNAME}" -c "npm config set prefix '~/.npm-global'"
  log "npm global directory set to ~/.npm-global for ${USERNAME}"
fi

log "Node.js 22 installation complete."
