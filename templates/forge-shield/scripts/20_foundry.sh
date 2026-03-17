#!/usr/bin/env bash
# 20_foundry.sh — Install Foundry EVM toolkit (forge, cast, anvil, chisel)
# Runs as root inside the container. USERNAME env var must be set.
set -euo pipefail

log() { echo "[20_foundry] $*"; }

: "${USERNAME:?USERNAME env var must be set}"

# Idempotency guard
if su - "$USERNAME" -c "command -v forge" &>/dev/null; then
  FORGE_VER=$(su - "$USERNAME" -c "~/.foundry/bin/forge --version 2>/dev/null || forge --version")
  log "Foundry already installed: $FORGE_VER — skipping"
  exit 0
fi

log "Installing Foundry for user: $USERNAME"

# Install foundryup as the non-root user
log "Downloading and running foundryup installer..."
su - "$USERNAME" -c "curl -L https://foundry.paradigm.xyz | bash"

# Run foundryup to install forge, cast, anvil, chisel
log "Running foundryup to install Foundry binaries..."
su - "$USERNAME" -c "source ~/.bashrc 2>/dev/null; ~/.foundry/bin/foundryup"

# Verify all four binaries are present
log "Verifying Foundry installations..."
FORGE_VERSION=$(su - "$USERNAME" -c "~/.foundry/bin/forge --version")
log "  forge: $FORGE_VERSION"

for BIN in cast anvil chisel; do
  if su - "$USERNAME" -c "test -x ~/.foundry/bin/$BIN"; then
    log "  $BIN: OK"
  else
    log "ERROR: $BIN not found in ~/.foundry/bin/" >&2
    exit 1
  fi
done

log "Foundry installation complete"
# Note: ~/.foundry/bin is added to PATH via PATH_APPEND in template.yaml
