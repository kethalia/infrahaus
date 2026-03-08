#!/usr/bin/env bash
# 00_base-system.sh — Base system configuration
# Sets locale, timezone, and installs foundational apt packages
# Runs INSIDE the container via pct exec as root
# Environment: USERNAME, USER_SHELL, CTID, LANG, LC_ALL (from template env)
set -euo pipefail

SCRIPT_NAME="00_base-system"
LOG_PREFIX="[$SCRIPT_NAME]"

log() { echo "$LOG_PREFIX $*"; }

log "Starting base system configuration..."

# ─── LOCALE ───────────────────────────────────────────────────────────────────

# Guard: skip if locale already configured (idempotent)
if grep -q "^en_US.UTF-8 UTF-8" /etc/locale.gen 2>/dev/null; then
    log "Locale already configured (en_US.UTF-8 UTF-8 present in /etc/locale.gen)"
else
    log "Configuring locale..."
    # Uncomment en_US.UTF-8 UTF-8 in /etc/locale.gen
    sed -i 's/^# *en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen

    # Ensure the line exists even if it was never in the file
    if ! grep -q "^en_US.UTF-8 UTF-8" /etc/locale.gen; then
        echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen
    fi

    log "Generating locale..."
    locale-gen

    log "Setting system locale..."
    update-locale LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
    log "Locale configured: en_US.UTF-8"
fi

# ─── TIMEZONE ─────────────────────────────────────────────────────────────────

log "Setting timezone to UTC..."
ln -sf /usr/share/zoneinfo/UTC /etc/localtime
dpkg-reconfigure -f noninteractive tzdata
log "Timezone set to UTC"

# ─── APT UPDATE ───────────────────────────────────────────────────────────────

log "Updating package lists..."
# Always refresh — ensures subsequent scripts get current package lists
DEBIAN_FRONTEND=noninteractive apt-get update -qq
log "Package lists updated"

# ─── FOUNDATIONAL HTTPS PACKAGES ──────────────────────────────────────────────

log "Installing foundational HTTPS transport packages..."
# Required before any external apt repos can be added (HTTPS, cert validation)
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    apt-transport-https \
    ca-certificates
log "HTTPS transport packages installed"

# ─── APT CACHE CLEANUP ────────────────────────────────────────────────────────

log "Cleaning apt cache..."
apt-get clean
rm -rf /var/lib/apt/lists/*
log "Apt cache cleaned (will be refreshed on next apt-get update)"

log "Base system configuration complete."
