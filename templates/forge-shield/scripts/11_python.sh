#!/usr/bin/env bash
# 11_python.sh — Configure Python 3 with pipx (PEP 668 compliant)
# Runs as root inside the container. USERNAME env var must be set.
# NOTE: Do NOT use pip install directly — Ubuntu 24.04 enforces PEP 668.
#       All Python CLI tools must be installed via pipx.
set -euo pipefail

LOG_PREFIX="[11_python]"

log() { echo "${LOG_PREFIX} $*"; }

# Guard: skip if pipx is already available system-wide
if command -v pipx &>/dev/null; then
  log "pipx already installed ($(pipx --version)), skipping."
  exit 0
fi

log "Installing pipx and configuring Python tool environment..."

# Install pipx from apt (idempotent — apt skips if already installed)
# Python 3 itself is already available from the base packages phase
apt-get install -y pipx

# Configure pipx environment for the non-root user
if [[ -z "${USERNAME:-}" ]]; then
  log "WARNING: USERNAME not set, skipping user pipx setup."
else
  log "Running pipx ensurepath for user '${USERNAME}'..."
  # pipx ensurepath adds ~/.local/bin to the user's shell PATH configs
  su - "${USERNAME}" -c "pipx ensurepath"

  # Verify pipx is functional as the user
  log "Verifying pipx for ${USERNAME}: $(su - "${USERNAME}" -c "pipx --version")"
fi

log "Python/pipx setup complete."
log "REMINDER: Use 'pipx install <tool>' — never 'pip install' system-wide on Ubuntu 24.04."
