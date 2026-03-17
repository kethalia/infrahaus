#!/usr/bin/env bash
# 21_solc-select.sh — Install solc-select and set default Solidity version
# Requires: 11_python.sh (pipx must be installed and configured)
# Runs as root inside the container. USERNAME env var must be set.
set -euo pipefail

log() { echo "[21_solc-select] $*"; }

: "${USERNAME:?USERNAME env var must be set}"

DEFAULT_SOLC_VERSION="0.8.28"

# Idempotency guard
if su - "$USERNAME" -c "command -v solc-select" &>/dev/null; then
  log "solc-select already installed — skipping"
  exit 0
fi

log "Installing solc-select for user: $USERNAME"

# Install via pipx (pipx is set up by 11_python.sh)
log "Installing solc-select via pipx..."
su - "$USERNAME" -c "pipx install solc-select"

# Install and set the default Solidity version
log "Installing Solidity ${DEFAULT_SOLC_VERSION} and setting as default..."
su - "$USERNAME" -c "solc-select install ${DEFAULT_SOLC_VERSION}"
su - "$USERNAME" -c "solc-select use ${DEFAULT_SOLC_VERSION}"

# Verify installation
log "Verifying solc-select..."
VERSIONS=$(su - "$USERNAME" -c "solc-select versions")
log "  Available versions: $VERSIONS"

SOLC_VER=$(su - "$USERNAME" -c "solc --version")
log "  Active solc: $SOLC_VER"

log "solc-select installation complete (default: Solidity ${DEFAULT_SOLC_VERSION})"
