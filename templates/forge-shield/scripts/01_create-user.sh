#!/usr/bin/env bash
# 01_create-user.sh — Create non-root user with sudo and home directory
# Runs INSIDE the container via pct exec as root
# Environment: USERNAME, USER_SHELL, USER_UID (optional, defaults 1000), SSH_KEYS (optional)
set -euo pipefail

SCRIPT_NAME="01_create-user"
LOG_PREFIX="[$SCRIPT_NAME]"

log() { echo "$LOG_PREFIX $*"; }

log "Starting user creation for: ${USERNAME:?USERNAME env var required}"

# ─── GUARD ────────────────────────────────────────────────────────────────────

# Idempotency: skip if user already exists
if id "$USERNAME" &>/dev/null; then
    log "User '$USERNAME' already exists — skipping creation"
    # Still ensure directories and permissions are correct
else
    # ─── CREATE USER ──────────────────────────────────────────────────────────

    log "Creating user '$USERNAME' (uid=${USER_UID:-1000}, shell=${USER_SHELL:-/bin/bash})..."
    useradd \
        --create-home \
        --shell "${USER_SHELL:-/bin/bash}" \
        --uid "${USER_UID:-1000}" \
        "$USERNAME"
    log "User '$USERNAME' created"
fi

# ─── SUDO ACCESS ──────────────────────────────────────────────────────────────

log "Configuring sudo access for '$USERNAME'..."

# Add to sudo group
usermod -aG sudo "$USERNAME"

# Configure passwordless sudo via /etc/sudoers.d
SUDOERS_FILE="/etc/sudoers.d/$USERNAME"
echo "$USERNAME ALL=(ALL) NOPASSWD:ALL" > "$SUDOERS_FILE"
chmod 0440 "$SUDOERS_FILE"

# Validate sudoers file before proceeding (prevents lockout)
visudo -cf "$SUDOERS_FILE"
log "Passwordless sudo configured and validated for '$USERNAME'"

# ─── ESSENTIAL DIRECTORIES ────────────────────────────────────────────────────

log "Creating essential home directories for '$USERNAME'..."

# User-local bin (for pipx, cargo install, etc.)
install -d -m 0755 -o "$USERNAME" -g "$USERNAME" "/home/$USERNAME/.local/bin"

# User config directory
install -d -m 0755 -o "$USERNAME" -g "$USERNAME" "/home/$USERNAME/.config"

# SSH directory (strict permissions required by ssh)
install -d -m 0700 -o "$USERNAME" -g "$USERNAME" "/home/$USERNAME/.ssh"

log "Essential directories created"

# ─── OWNERSHIP ────────────────────────────────────────────────────────────────

log "Setting ownership of /home/$USERNAME..."
chown -R "$USERNAME:$USERNAME" "/home/$USERNAME"
log "Ownership set"

# ─── SSH AUTHORIZED KEYS ──────────────────────────────────────────────────────

# Only write authorized_keys if SSH_KEYS env var is set and non-empty
if [[ -n "${SSH_KEYS:-}" ]]; then
    log "Writing SSH authorized keys..."
    AUTHORIZED_KEYS_FILE="/home/$USERNAME/.ssh/authorized_keys"
    echo "$SSH_KEYS" > "$AUTHORIZED_KEYS_FILE"
    chmod 0600 "$AUTHORIZED_KEYS_FILE"
    chown "$USERNAME:$USERNAME" "$AUTHORIZED_KEYS_FILE"
    log "SSH authorized keys written to $AUTHORIZED_KEYS_FILE"
else
    log "No SSH_KEYS provided — skipping authorized_keys setup"
fi

log "User creation complete for '$USERNAME'."
