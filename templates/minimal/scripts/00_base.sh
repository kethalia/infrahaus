#!/usr/bin/env bash
set -euo pipefail
# 00_base.sh -- Minimal base setup
# Idempotent: safe to run multiple times

echo "[00_base] Starting base system configuration..."

# Configure locale
echo "[00_base] Configuring locale..."
locale-gen en_US.UTF-8 2>/dev/null || true
update-locale LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 2>/dev/null || true

# Update package index
echo "[00_base] Updating package lists..."
apt-get update -qq

# Upgrade existing packages (non-interactive)
echo "[00_base] Upgrading packages..."
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

echo "[00_base] Base configuration complete"
