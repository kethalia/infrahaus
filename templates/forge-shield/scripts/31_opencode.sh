#!/usr/bin/env bash
# 31_opencode.sh — Install OpenCode AI coding assistant
# Requires: 12_go.sh (Go runtime available as fallback install method)
# Runs as root inside the container. USERNAME env var must be set.
set -euo pipefail

log() { echo "[31_opencode] $*"; }

: "${USERNAME:?USERNAME env var must be set}"

# Idempotency guard
if su - "$USERNAME" -c "command -v opencode" &>/dev/null; then
  log "OpenCode already installed — skipping"
  exit 0
fi

log "Installing OpenCode for user: $USERNAME"

# Attempt 1: Official installer
log "Trying official OpenCode installer..."
if su - "$USERNAME" -c "curl -fsSL https://opencode.ai/install | bash" 2>/dev/null; then
  log "OpenCode installed via official installer"
else
  log "Official installer failed — falling back to Go install method"

  # Attempt 2: Go install (requires Go from 12_go.sh)
  if ! su - "$USERNAME" -c "command -v go || /usr/local/go/bin/go version" &>/dev/null; then
    log "ERROR: Go not available for fallback install. Run 12_go.sh first." >&2
    exit 1
  fi

  log "Installing OpenCode via go install..."
  su - "$USERNAME" -c "PATH=\$PATH:/usr/local/go/bin ~/go/bin go install github.com/opencode-ai/opencode@latest 2>/dev/null || /usr/local/go/bin/go install github.com/opencode-ai/opencode@latest"
  log "OpenCode installed via go install"
fi

# Verify: accept version output or help text as success
log "Verifying OpenCode installation..."
if su - "$USERNAME" -c "opencode --version 2>/dev/null || opencode --help 2>/dev/null" | grep -q "."; then
  log "OpenCode verified successfully"
else
  log "WARNING: OpenCode may be installed but verification was inconclusive"
fi

log "OpenCode installation complete"
