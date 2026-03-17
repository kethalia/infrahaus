#!/usr/bin/env bash
# 99-post-setup.sh — Final validation, cleanup, and welcome message
#
# Runs last after all other setup scripts. Validates that each component is
# installed and configured, cleans up apt cache, and prints a welcome message
# with access details.
#
# Exits 0 even if some checks fail — warnings are logged but setup is not
# blocked (some tools may not be installed yet, e.g. openclaw).
#
# Usage: sudo ./99-post-setup.sh

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

info "=== Post-Setup Tasks ==="

if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root. Try: sudo $0"
    exit 1
fi

# ---------------------------------------------------------------------------
# 1. Validation — check commands, services, and openclaw
# ---------------------------------------------------------------------------
info "Running validation checks..."

CHECKS_PASSED=0
CHECKS_TOTAL=0

check_cmd() {
    local cmd="$1"
    local hint="${2:-}"
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    if command -v "$cmd" &>/dev/null; then
        info "  [PASS] command: $cmd"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        warn "  [WARN] command not found: $cmd${hint:+ — $hint}"
    fi
}

check_service_enabled() {
    local svc="$1"
    local hint="${2:-}"
    CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
    if systemctl is-enabled "$svc" &>/dev/null; then
        info "  [PASS] service enabled: $svc"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        warn "  [WARN] service not enabled: $svc${hint:+ — $hint}"
    fi
}

# Commands
check_cmd node       "run 03-nodejs-setup.sh"
check_cmd npm        "run 03-nodejs-setup.sh"
check_cmd google-chrome "run 04-chrome-install.sh"
check_cmd vncserver  "run 05-vnc-setup.sh"

# OpenClaw — soft check only (may require separate install step)
CHECKS_TOTAL=$((CHECKS_TOTAL + 1))
if which openclaw &>/dev/null 2>&1; then
    info "  [PASS] command: openclaw"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
    warn "  [WARN] openclaw not found — run 06-openclaw-install.sh when the package is available on npm"
fi

# Services
check_service_enabled lightdm        "run 02-desktop-setup.sh"
check_service_enabled qemu-guest-agent "run 02-desktop-setup.sh"
check_service_enabled vncserver@1    "run 05-vnc-setup.sh"

# ---------------------------------------------------------------------------
# 2. Cleanup
# ---------------------------------------------------------------------------
info "Cleaning up apt cache..."
apt-get autoremove -y
apt-get clean
info "Cleanup complete."

# ---------------------------------------------------------------------------
# 3. Software versions
# ---------------------------------------------------------------------------
info "Installed software versions:"
node --version 2>/dev/null && info "  Node.js: $(node --version)" || warn "  Node.js: not found"
npm --version  2>/dev/null && info "  npm:     v$(npm --version)" || warn "  npm: not found"
google-chrome --version 2>/dev/null && info "  Chrome:  $(google-chrome --version)" || warn "  Chrome: not found"
vncserver --version 2>/dev/null | head -1 | xargs -I{} info "  VNC:     {}" || warn "  vncserver: not found"

# ---------------------------------------------------------------------------
# 4. Get VM IP for welcome message
# ---------------------------------------------------------------------------
VM_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "<VM_IP>")

# ---------------------------------------------------------------------------
# 5. Welcome message
# ---------------------------------------------------------------------------
cat << EOF

===================================================================
        OpenClaw Desktop VM — Setup Complete!
===================================================================

Access Methods:
  Proxmox Console   Proxmox UI → VM → Console tab
  VNC (port 5901)   vncviewer ${VM_IP}:5901
  SSH               ssh openclaw@${VM_IP}

Default Credentials:
  User:             openclaw
  SSH password:     openclaw  (CHANGE ON FIRST LOGIN)
  VNC password:     openclaw  (set by 05-vnc-setup.sh)

  SECURITY: Change the SSH password immediately:
    passwd openclaw

Desktop:
  Session:          XFCE4
  Display Manager:  LightDM (auto-login as openclaw)
  VNC resolution:   1920x1080

Installed Software:
  Node.js 22        (via NodeSource)
  Google Chrome     (via Google repository)
  TigerVNC          (remote desktop on port 5901)
  qemu-guest-agent  (Proxmox integration)

Quick Commands:
  Re-run a script:  ./run-scripts.sh <VM_IP> <script-name>
  VNC connect:      vncviewer ${VM_IP}:5901
  SSH connect:      ssh openclaw@${VM_IP}

===================================================================

EOF

# ---------------------------------------------------------------------------
# 6. Summary
# ---------------------------------------------------------------------------
info "=== Validation Summary: ${CHECKS_PASSED} of ${CHECKS_TOTAL} checks passed ==="

if [[ $CHECKS_PASSED -eq $CHECKS_TOTAL ]]; then
    info "All checks passed. Desktop VM is fully configured."
else
    CHECKS_FAILED=$((CHECKS_TOTAL - CHECKS_PASSED))
    warn "${CHECKS_FAILED} check(s) failed (see warnings above)."
    warn "Some scripts may need to be re-run or packages installed manually."
fi

info "Setup completed at $(date)"

# Always exit 0 — post-setup never blocks (failures are warnings, not errors)
exit 0
