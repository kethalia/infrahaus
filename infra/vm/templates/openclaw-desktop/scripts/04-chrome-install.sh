#!/usr/bin/env bash
# 04-chrome-install.sh — Google Chrome via modern GPG keyring
#
# Installs Google Chrome stable using the modern signed-by GPG approach
# (NOT the deprecated method). Idempotent: skips if already installed.
#
# Usage: sudo ./04-chrome-install.sh

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

info "=== Installing Google Chrome ==="

if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root. Try: sudo $0"
    exit 1
fi

# ---------------------------------------------------------------------------
# 1. Idempotency check
# ---------------------------------------------------------------------------
if which google-chrome-stable &>/dev/null || which google-chrome &>/dev/null; then
    CHROME_VER=$(google-chrome-stable --version 2>/dev/null || google-chrome --version 2>/dev/null)
    info "Google Chrome already installed: ${CHROME_VER}"
    info "Skipping installation."
    exit 0
fi

# ---------------------------------------------------------------------------
# 2. Ensure gnupg and apt-transport are available
# ---------------------------------------------------------------------------
info "Ensuring dependencies (gnupg, curl)..."
apt-get install -y gnupg curl

# ---------------------------------------------------------------------------
# 3. Add GPG key using modern signed-by keyring approach
# ---------------------------------------------------------------------------
info "Adding Google Chrome GPG key..."
curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
    | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg

chmod 644 /usr/share/keyrings/google-chrome.gpg
info "GPG key installed at /usr/share/keyrings/google-chrome.gpg"

# ---------------------------------------------------------------------------
# 4. Add Chrome repository
# ---------------------------------------------------------------------------
info "Adding Google Chrome repository..."
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
    > /etc/apt/sources.list.d/google-chrome.list

# ---------------------------------------------------------------------------
# 5. Install Chrome
# ---------------------------------------------------------------------------
info "Installing google-chrome-stable..."
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y google-chrome-stable
info "Google Chrome installed."

# ---------------------------------------------------------------------------
# 6. Verify
# ---------------------------------------------------------------------------
CHROME_VER=$(google-chrome --version 2>/dev/null || google-chrome-stable --version 2>/dev/null)
info "Installed: ${CHROME_VER}"

info "=== Chrome Installation Complete ==="
info "  Version: ${CHROME_VER}"
info "  Keyring: /usr/share/keyrings/google-chrome.gpg (modern signed-by method)"
