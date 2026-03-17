#!/usr/bin/env bash
# 01-setup-user.sh — openclaw user configuration
#
# Creates the openclaw user (UID 1000) with sudo, audio, video, render groups.
# Configures passwordless sudo and sets initial password.
# Idempotent: safe to re-run on an already-configured VM.
#
# Usage: sudo ./01-setup-user.sh

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

info "=== Setting Up openclaw User ==="

if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root. Try: sudo $0"
    exit 1
fi

# Ensure sudo is installed (minimal Debian images may not include it)
if ! command -v sudo &>/dev/null; then
    info "Installing sudo..."
    apt-get install -y -qq sudo
fi

# ---------------------------------------------------------------------------
# 1. Create user if not exists
# ---------------------------------------------------------------------------
_user_created=false
if id openclaw &>/dev/null 2>&1; then
    info "User 'openclaw' already exists."
else
    info "Creating user 'openclaw' (UID 1000)..."
    useradd -m -u 1000 -s /bin/bash openclaw
    _user_created=true
    info "User created."
fi

# ---------------------------------------------------------------------------
# 2. Add to groups (idempotent — usermod -aG is safe to re-run)
# ---------------------------------------------------------------------------
info "Adding openclaw to groups: sudo, audio, video, render..."
usermod -aG sudo,audio,video openclaw

# render group may not exist on all systems (GPU passthrough setups)
if getent group render &>/dev/null; then
    usermod -aG render openclaw
else
    warn "Group 'render' does not exist — skipping (normal without GPU passthrough)."
fi

info "Group membership updated."

# ---------------------------------------------------------------------------
# 3. Configure passwordless sudo
# ---------------------------------------------------------------------------
info "Configuring passwordless sudo for openclaw..."
mkdir -p /etc/sudoers.d
cat > /etc/sudoers.d/openclaw <<'EOF'
# Allow openclaw user full passwordless sudo (desktop VM)
openclaw ALL=(ALL) NOPASSWD:ALL
EOF
chmod 440 /etc/sudoers.d/openclaw

if visudo -c -f /etc/sudoers.d/openclaw &>/dev/null; then
    info "Sudoers configuration applied."
else
    error "Invalid sudoers configuration. Removing file."
    rm -f /etc/sudoers.d/openclaw
    exit 1
fi

# ---------------------------------------------------------------------------
# 4. Set initial password
# ---------------------------------------------------------------------------
info "Setting initial password for openclaw..."
echo "openclaw:openclaw" | chpasswd
info "Password set to: openclaw"

# Set password expiry on first login ONLY for newly created users.
# Existing users who already changed their password must NOT be forced to change
# again — that would lock them out of VNC sessions.
if [[ "$_user_created" == true ]]; then
    info "Marking password as expired (user must change on first interactive login)..."
    chage -d 0 openclaw
else
    info "Existing user — skipping chage to preserve any previously set password."
fi

# ---------------------------------------------------------------------------
# 5. Ensure home directory ownership
# ---------------------------------------------------------------------------
info "Ensuring /home/openclaw ownership..."
chown -R openclaw:openclaw /home/openclaw
info "Ownership verified."

info "=== User Setup Complete ==="
info "  User:    openclaw (UID 1000)"
info "  Groups:  $(groups openclaw | cut -d: -f2 | xargs)"
info "  Sudo:    passwordless (NOPASSWD:ALL)"
info "  Home:    /home/openclaw"
