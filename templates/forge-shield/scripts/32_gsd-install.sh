#!/usr/bin/env bash
# 32_gsd-install.sh — Install GSD (Get Shit Done) workflow
# Installs GSD to ~/.config/Claude/get-shit-done/ for the non-root user
# Runs as root inside the container. USERNAME env var must be set.
set -euo pipefail

log() { echo "[32_gsd-install] $*"; }

: "${USERNAME:?USERNAME env var must be set}"

GSD_DIR="/home/${USERNAME}/.config/Claude/get-shit-done"

# Idempotency guard
if su - "$USERNAME" -c "test -d ~/.config/Claude/get-shit-done" 2>/dev/null; then
  FILE_COUNT=$(su - "$USERNAME" -c "ls ~/.config/Claude/get-shit-done/ | wc -l")
  log "GSD already installed (${FILE_COUNT} files) — skipping"
  exit 0
fi

log "Installing GSD workflow for user: $USERNAME"

# Attempt 1: Clone and run installer
log "Cloning GSD repository..."
if su - "$USERNAME" -c "git clone https://github.com/clydeai-lab/get-shit-done.git /tmp/gsd-install 2>/dev/null"; then
  log "Repository cloned successfully"

  log "Running GSD installer..."
  if su - "$USERNAME" -c "cd /tmp/gsd-install && bash install.sh"; then
    log "GSD installer completed"
  else
    log "WARNING: GSD installer returned non-zero exit — checking if files exist..."
  fi

  # Clean up
  log "Cleaning up temporary clone..."
  su - "$USERNAME" -c "rm -rf /tmp/gsd-install"
else
  # Attempt 2: Private repo or unavailable — create directory structure manually
  log "WARNING: Could not clone GSD repository (private repo or unavailable)"
  log "Creating minimal GSD directory structure for manual installation..."

  su - "$USERNAME" -c "mkdir -p ~/.config/Claude/get-shit-done"

  log "IMPORTANT: GSD must be installed manually after container setup:"
  log "  1. Obtain access to the GSD repository"
  log "  2. Clone to /tmp/gsd-install and run: bash install.sh"
  log "  3. Or manually place GSD files in ~/.config/Claude/get-shit-done/"
fi

# Verify
log "Verifying GSD installation..."
if su - "$USERNAME" -c "ls ~/.config/Claude/get-shit-done/" &>/dev/null; then
  FILE_COUNT=$(su - "$USERNAME" -c "ls ~/.config/Claude/get-shit-done/ | wc -l")
  log "GSD directory exists with ${FILE_COUNT} entries"
else
  log "ERROR: GSD directory not found after installation attempt" >&2
  exit 1
fi

log "GSD installation complete"
