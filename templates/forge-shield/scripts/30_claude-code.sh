#!/usr/bin/env bash
# 30_claude-code.sh — Install Claude Code CLI
# Requires: 10_node.sh (Node.js runtime must be installed)
# Runs as root inside the container. USERNAME env var must be set.
set -euo pipefail

log() { echo "[30_claude-code] $*"; }

: "${USERNAME:?USERNAME env var must be set}"

# Idempotency guard
if su - "$USERNAME" -c "command -v claude" &>/dev/null; then
  CLAUDE_VER=$(su - "$USERNAME" -c "claude --version 2>/dev/null || echo '(version unknown)'")
  log "Claude Code already installed: $CLAUDE_VER — skipping"
  exit 0
fi

log "Installing Claude Code CLI for user: $USERNAME"

# Install via official installer as the non-root user
log "Running official Claude Code installer..."
su - "$USERNAME" -c "curl -fsSL https://claude.ai/install.sh | bash"

# Verify installation (may output version or help text — either is success)
log "Verifying Claude Code installation..."
if su - "$USERNAME" -c "claude --version 2>/dev/null || claude --help 2>/dev/null" | grep -q "."; then
  log "Claude Code CLI installed successfully"
else
  log "WARNING: Claude Code installed but verification output was empty — may still work"
fi

log "Claude Code installation complete"
# Note: Claude Code requires authentication on first use (claude auth login)
# This is expected — authentication happens interactively when the user first runs Claude Code
