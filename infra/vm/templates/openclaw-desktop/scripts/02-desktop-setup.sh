#!/usr/bin/env bash
# 02-desktop-setup.sh — XFCE desktop environment with LightDM auto-login
#
# Installs task-xfce-desktop, LightDM with auto-login for the openclaw user,
# sets graphical target, and enables qemu-guest-agent for Proxmox integration.
# Idempotent: skips XFCE install if already present.
#
# Usage: sudo ./02-desktop-setup.sh

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

info "=== Setting Up XFCE Desktop Environment ==="

if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root. Try: sudo $0"
    exit 1
fi

# ---------------------------------------------------------------------------
# 1. Update package index
# ---------------------------------------------------------------------------
info "Updating package index..."
apt-get update

# ---------------------------------------------------------------------------
# 2. Install XFCE desktop and display manager
# ---------------------------------------------------------------------------
if dpkg -l task-xfce-desktop 2>/dev/null | grep -q '^ii'; then
    info "task-xfce-desktop is already installed — skipping."
else
    info "Installing XFCE desktop, LightDM, and greeter (this may take several minutes)..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        task-xfce-desktop \
        lightdm \
        lightdm-gtk-greeter
    info "XFCE desktop installed."
fi

# Ensure LightDM and greeter are installed even if task-xfce-desktop was already present
if ! dpkg -l lightdm 2>/dev/null | grep -q '^ii'; then
    info "Installing LightDM..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y lightdm lightdm-gtk-greeter
fi

# ---------------------------------------------------------------------------
# 3. Configure LightDM auto-login for openclaw user
# ---------------------------------------------------------------------------
info "Configuring LightDM auto-login for openclaw user..."
mkdir -p /etc/lightdm/lightdm.conf.d
cat > /etc/lightdm/lightdm.conf.d/50-autologin.conf <<'EOF'
[Seat:*]
autologin-user=openclaw
autologin-user-timeout=0
greeter-session=lightdm-gtk-greeter
EOF
info "LightDM auto-login configured."

# ---------------------------------------------------------------------------
# 4. Set graphical target and enable LightDM
# ---------------------------------------------------------------------------
info "Setting default target to graphical.target..."
systemctl set-default graphical.target

info "Enabling LightDM service..."
systemctl enable lightdm
info "LightDM enabled."

# ---------------------------------------------------------------------------
# 5. Install and enable qemu-guest-agent (Proxmox integration)
# ---------------------------------------------------------------------------
if dpkg -l qemu-guest-agent 2>/dev/null | grep -q '^ii'; then
    info "qemu-guest-agent already installed."
else
    info "Installing qemu-guest-agent..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y qemu-guest-agent
fi

info "Enabling qemu-guest-agent..."
systemctl enable --now qemu-guest-agent 2>/dev/null || \
    systemctl enable qemu-guest-agent 2>/dev/null || \
    warn "Could not enable qemu-guest-agent (may require VM restart or KVM environment)."

info "=== Desktop Setup Complete ==="
info "  Desktop:     XFCE (task-xfce-desktop)"
info "  Display Mgr: LightDM with auto-login for 'openclaw'"
info "  Target:      graphical.target"
info "  Guest Agent: qemu-guest-agent enabled"
info ""
info "NOTE: The VM must be rebooted for the graphical session to start."
