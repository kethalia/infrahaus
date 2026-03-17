#!/usr/bin/env bash
# 50_claude-skills.sh — Set up Claude skill directories and community security skills (idempotent)
# Runs as root inside the LXC container. USERNAME env var must be set.
set -euo pipefail

LOG_PREFIX="[50_claude-skills]"

log() { echo "${LOG_PREFIX} $*"; }

: "${USERNAME:?USERNAME env var must be set}"

# Guard: skip if Claude commands directory already has files
if [[ -d "/home/${USERNAME}/.claude/commands" ]] && \
   [[ -n "$(ls -A "/home/${USERNAME}/.claude/commands" 2>/dev/null)" ]]; then
    log "Claude commands already configured — skipping"
    exit 0
fi

log "Setting up Claude skill directories for user: ${USERNAME}"

# Ensure required directories exist
su - "${USERNAME}" -c "mkdir -p ~/.claude/commands ~/.claude/skills"
log "Created ~/.claude/commands and ~/.claude/skills"

# Set correct ownership
chown -R "${USERNAME}:${USERNAME}" "/home/${USERNAME}/.claude"
log "Set ownership of ~/.claude to ${USERNAME}"

log "Note: Claude slash command files and CLAUDE.md are pushed by the engine file push phase"

# Optionally install community security skills from GitHub
log "Attempting to clone community security skills from GitHub..."
su - "${USERNAME}" -c "git clone --depth 1 https://github.com/anthropics/claude-code-skills.git /tmp/claude-skills 2>/dev/null || true"

if [[ -d "/tmp/claude-skills/security" ]]; then
    log "Copying security-related skills..."
    su - "${USERNAME}" -c "cp -r /tmp/claude-skills/security/* ~/.claude/skills/ 2>/dev/null || true"
    log "Community security skills installed to ~/.claude/skills/"
else
    log "No security skills directory found in repo (or clone failed) — continuing without community skills"
fi

# Clean up temporary clone
su - "${USERNAME}" -c "rm -rf /tmp/claude-skills"
log "Cleaned up temporary clone"

# Final ownership correction
chown -R "${USERNAME}:${USERNAME}" "/home/${USERNAME}/.claude"

log "Claude skills setup complete"
