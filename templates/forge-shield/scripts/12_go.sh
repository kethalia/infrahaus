#!/usr/bin/env bash
# 12_go.sh — Install Go from official tarball
# Runs as root inside the container. USERNAME env var must be set.
# NOTE: PATH additions for /usr/local/go/bin are handled by the engine's
#       env phase which reads PATH_APPEND from template.yaml.
set -euo pipefail

LOG_PREFIX="[12_go]"

log() { echo "${LOG_PREFIX} $*"; }

# Pinned version for reproducibility — update manually when needed
GO_VERSION="1.23.6"

# Guard: skip if Go is already installed
if command -v go &>/dev/null; then
  log "Go $(go version) already installed, skipping."
  exit 0
fi

log "Installing Go ${GO_VERSION} from official tarball..."

# Download the official Go tarball
wget -q "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" -O /tmp/go.tar.gz

# Remove any previous Go installation and extract fresh
rm -rf /usr/local/go
tar -C /usr/local -xzf /tmp/go.tar.gz

# Clean up download
rm /tmp/go.tar.gz

# Verify installation using the absolute path (PATH not yet updated in this session)
log "Installed: $(/usr/local/go/bin/go version)"

# Set up user Go workspace directories
if [[ -z "${USERNAME:-}" ]]; then
  log "WARNING: USERNAME not set, skipping user GOPATH setup."
else
  log "Creating Go workspace directories for user '${USERNAME}'..."
  su - "${USERNAME}" -c "mkdir -p ~/go/bin ~/go/src ~/go/pkg"
  log "Go workspace at ~/go created for ${USERNAME}"
fi

log "Go ${GO_VERSION} installation complete."
