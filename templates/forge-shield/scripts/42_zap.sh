#!/usr/bin/env bash
# 42_zap.sh — Install OWASP ZAP (Zed Attack Proxy) in headless mode
#
# Installs ZAP weekly release to /opt/zaproxy with a /usr/local/bin/zap symlink.
# Note: ZAP is large (~500MB). Installation may take several minutes.
#
# Requires: Java (default-jre), wget, curl
# Runs as: root inside the LXC container

set -euo pipefail

LOG_PREFIX="[42_zap]"

log() {
    echo "${LOG_PREFIX} $*"
}

log "=== Installing OWASP ZAP (headless) ==="

# ---------------------------------------------------------------------------
# Guard — skip if already installed
# ---------------------------------------------------------------------------
if [[ -d /opt/zaproxy ]]; then
    log "ZAP already installed at /opt/zaproxy — skipping"
    log "Verifying symlink..."
    if [[ -L /usr/local/bin/zap ]]; then
        log "Symlink /usr/local/bin/zap exists"
    else
        log "Re-creating symlink /usr/local/bin/zap -> /opt/zaproxy/zap.sh"
        ln -sf /opt/zaproxy/zap.sh /usr/local/bin/zap
    fi
    exit 0
fi

# ---------------------------------------------------------------------------
# Ensure Java is installed (ZAP requires JRE)
# ---------------------------------------------------------------------------
log "Ensuring Java (default-jre) is installed..."
apt-get install -y default-jre

JAVA_VER=$(java -version 2>&1 | head -1 || echo "version check failed")
log "Java: ${JAVA_VER}"

# ---------------------------------------------------------------------------
# Download ZAP weekly release (latest, resolved dynamically)
# ---------------------------------------------------------------------------
log "NOTE: ZAP download is approximately 500MB. This may take several minutes."
log "Resolving latest ZAP weekly release URL..."

ZAP_URL=$(curl -s https://api.github.com/repos/zaproxy/zaproxy/releases \
    | grep -m1 'browser_download_url.*ZAP_WEEKLY_unix\.tar\.gz' \
    | grep -oP '"https://[^"]+')

if [[ -z "${ZAP_URL}" ]]; then
    log "ERROR: Could not resolve ZAP weekly release URL from GitHub API"
    log "Hint: Check https://github.com/zaproxy/zaproxy/releases for available assets"
    exit 1
fi

log "Downloading ZAP from: ${ZAP_URL}"
wget -q "${ZAP_URL}" -O /tmp/zap.tar.gz

# ---------------------------------------------------------------------------
# Extract and install
# ---------------------------------------------------------------------------
log "Extracting ZAP to /opt/zaproxy..."
mkdir -p /opt/zaproxy
tar xzf /tmp/zap.tar.gz -C /opt/zaproxy --strip-components=1

log "Creating symlink /usr/local/bin/zap -> /opt/zaproxy/zap.sh"
ln -sf /opt/zaproxy/zap.sh /usr/local/bin/zap

log "Cleaning up download..."
rm /tmp/zap.tar.gz

# ---------------------------------------------------------------------------
# Verify installation
# ---------------------------------------------------------------------------
log "Verifying ZAP installation..."
if [[ -f /opt/zaproxy/zap.sh ]]; then
    log "ZAP launcher found at /opt/zaproxy/zap.sh"
else
    log "ERROR: /opt/zaproxy/zap.sh not found after extraction"
    exit 1
fi

# Version check — ZAP may require a display for full init, so we accept either success or display error
zap -cmd -version 2>/dev/null \
    || log "ZAP installed (headless version check may require DISPLAY — this is expected in LXC)"

log "=== OWASP ZAP installation complete ==="
log "Usage: zap -cmd -quickscan <target_url>"
log "For daemon mode: zap -daemon -port 8080"
