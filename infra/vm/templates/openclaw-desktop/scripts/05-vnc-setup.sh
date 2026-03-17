#!/usr/bin/env bash
# 05-vnc-setup.sh — TigerVNC server with systemd service for remote access
#
# Installs TigerVNC, sets VNC password to 'openclaw' for the openclaw user,
# creates an XFCE xstartup script, and configures a systemd service.
#
# CRITICAL: VNC is configured with -localhost no so remote clients can connect.
#           Without this flag, VNC only accepts connections from localhost.
#
# Default VNC port: 5901 (display :1)
# VNC password: openclaw
#
# Idempotent: safe to re-run.
#
# Usage: sudo ./05-vnc-setup.sh

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

info "=== Setting Up TigerVNC ==="

if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root. Try: sudo $0"
    exit 1
fi

# Verify openclaw user exists
if ! id openclaw &>/dev/null; then
    error "User 'openclaw' not found. Run 01-setup-user.sh first."
    exit 1
fi

# ---------------------------------------------------------------------------
# 1. Install TigerVNC
# ---------------------------------------------------------------------------
if dpkg -l tigervnc-standalone-server 2>/dev/null | grep -q '^ii'; then
    info "tigervnc-standalone-server already installed — skipping."
else
    info "Installing TigerVNC..."
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        tigervnc-standalone-server \
        tigervnc-tools
    info "TigerVNC installed."
fi

# ---------------------------------------------------------------------------
# 2. Set VNC password for openclaw user
# ---------------------------------------------------------------------------
info "Configuring VNC password for openclaw user..."
sudo -u openclaw mkdir -p /home/openclaw/.vnc

# vncpasswd -f reads from stdin and writes the encrypted password file
echo "openclaw" | sudo -u openclaw vncpasswd -f > /home/openclaw/.vnc/passwd
chmod 600 /home/openclaw/.vnc/passwd
chown openclaw:openclaw /home/openclaw/.vnc/passwd

info "VNC password set to: openclaw"

# ---------------------------------------------------------------------------
# 3. Create xstartup script (launches XFCE4 session)
# ---------------------------------------------------------------------------
info "Creating VNC xstartup script..."
cat > /home/openclaw/.vnc/xstartup <<'EOF'
#!/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
exec startxfce4
EOF

chmod +x /home/openclaw/.vnc/xstartup
chown openclaw:openclaw /home/openclaw/.vnc/xstartup
info "xstartup configured to launch XFCE4."

# ---------------------------------------------------------------------------
# 4. Create systemd template unit
#    CRITICAL: -localhost no enables remote VNC connections (not just localhost)
# ---------------------------------------------------------------------------
info "Creating systemd vncserver@.service template unit..."
cat > /etc/systemd/system/vncserver@.service <<'EOF'
[Unit]
Description=TigerVNC server on display :%i
After=syslog.target network.target

[Service]
Type=forking
User=openclaw
Group=openclaw
WorkingDirectory=/home/openclaw
ExecStartPre=-/usr/bin/vncserver -kill :%i > /dev/null 2>&1 || true
ExecStart=/usr/bin/vncserver -depth 24 -geometry 1920x1080 -localhost no :%i
ExecStop=/usr/bin/vncserver -kill :%i

[Install]
WantedBy=multi-user.target
EOF

info "systemd unit created: /etc/systemd/system/vncserver@.service"
info "  Key flag: -localhost no (remote VNC clients can connect on port 5901)"

# ---------------------------------------------------------------------------
# 5. Enable vncserver for display :1 (port 5901)
# ---------------------------------------------------------------------------
info "Reloading systemd and enabling vncserver@1..."
systemctl daemon-reload
systemctl enable vncserver@1

# Verify
if systemctl is-enabled vncserver@1 &>/dev/null; then
    info "vncserver@1 is enabled."
else
    warn "systemctl is-enabled vncserver@1 returned non-zero (may be normal before first boot)."
fi

info "=== VNC Setup Complete ==="
info "  Server:   TigerVNC"
info "  Display:  :1 (port 5901)"
info "  Password: openclaw"
info "  Binding:  -localhost no (remote access enabled)"
info "  Session:  XFCE4"
info ""
info "Connect from remote: vncviewer <VM_IP>:5901"
info "Or via SSH tunnel:   ssh -L 5901:localhost:5901 openclaw@<VM_IP>"
