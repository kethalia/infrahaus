#!/usr/bin/env bash
# 06-openclaw-install.sh — Defensive OpenClaw installation
#
# IMPORTANT: This script checks the npm registry BEFORE attempting to install
# openclaw. If the package is not found on the public npm registry, it exits
# with a clear error message and actionable TODO instructions.
#
# Background: openclaw may not be published to the public npm registry.
# This script prevents a confusing npm ERR! 404 and provides clear next steps.
#
# Prerequisites: Run 03-nodejs-setup.sh first (requires Node.js + npm).
#
# Usage: sudo ./06-openclaw-install.sh

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

info "=== Installing OpenClaw ==="

if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root. Try: sudo $0"
    exit 1
fi

# Verify npm is available
if ! command -v npm &>/dev/null; then
    error "npm not found. Run 03-nodejs-setup.sh first."
    exit 1
fi

# ---------------------------------------------------------------------------
# Registry check — MUST happen before any install attempt
# ---------------------------------------------------------------------------
info "Checking npm registry for openclaw package..."

# npm view openclaw version: exits 0 if package exists, non-zero if not found.
# Suppress output — we only care about exit code.
if ! npm view openclaw version >/dev/null 2>&1; then
    error "openclaw package not found on npm registry (npm view openclaw version failed)."
    echo ""
    echo "This means openclaw is not published to the public npm registry."
    echo ""
    echo "TODO: Update this script with the correct installation method:"
    echo "  - Check the OpenClaw repository for install instructions"
    echo "  - Possible alternatives:"
    echo "      npm install -g @<org>/openclaw@latest"
    echo "      npx openclaw"
    echo "      Download binary from GitHub releases"
    echo ""
    echo "Once you know the correct source, edit this script and re-run:"
    echo "  ./run-scripts.sh <VM_IP> 06-openclaw-install.sh"
    echo ""
    # Exit 1 so run-scripts.sh knows this step failed and offers continue/abort
    exit 1
fi

info "openclaw found on npm registry."

# ---------------------------------------------------------------------------
# Install openclaw globally
# ---------------------------------------------------------------------------
info "Installing openclaw globally..."
npm install -g openclaw@latest

# ---------------------------------------------------------------------------
# Verify installation
# ---------------------------------------------------------------------------
if openclaw --version 2>/dev/null; then
    info "openclaw installed successfully."
elif which openclaw 2>/dev/null; then
    info "openclaw binary found at: $(which openclaw)"
else
    error "openclaw install appeared to succeed but 'openclaw' command not found in PATH."
    echo ""
    echo "Ensure /home/openclaw/.npm-global/bin is in PATH."
    echo "Run 03-nodejs-setup.sh first to configure the npm global prefix."
    echo ""
    echo "Manual check:"
    echo "  sudo -u openclaw bash -c 'source ~/.bashrc && openclaw --version'"
    exit 1
fi

info "=== OpenClaw Installation Complete ==="
