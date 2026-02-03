#!/bin/bash
# Setup coder user for web3-dev template
# This script runs during config-manager sync

set -euo pipefail

echo "=== Setting up coder user ==="

# Create coder user if it doesn't exist
if ! id -u coder >/dev/null 2>&1; then
    echo "Creating coder user (UID 1000)..."
    useradd -m -u 1000 -s /bin/bash -G sudo coder
    echo "✓ Created coder user"
else
    echo "✓ Coder user already exists"
    
    # Ensure user has correct groups
    if ! groups coder | grep -q sudo; then
        usermod -aG sudo coder
        echo "✓ Added coder to sudo group"
    fi
fi

# Configure sudoers
echo "Configuring sudo access..."
cat > /etc/sudoers.d/coder <<'EOF'
# Allow coder user passwordless sudo for development operations
coder ALL=(ALL) NOPASSWD: /usr/bin/systemctl, /usr/bin/docker, /usr/bin/git, /usr/local/bin/config-sync.sh, /usr/local/bin/config-rollback
# Allow full sudo with password for other operations
coder ALL=(ALL:ALL) ALL
EOF

chmod 0440 /etc/sudoers.d/coder

# Validate sudoers file syntax
if visudo -c -f /etc/sudoers.d/coder >/dev/null 2>&1; then
    echo "✓ Sudoers configuration applied"
else
    echo "ERROR: Invalid sudoers configuration"
    rm -f /etc/sudoers.d/coder
    exit 1
fi

# Ensure home directory exists and has correct permissions
if [ ! -d "/home/coder" ]; then
    mkdir -p /home/coder
fi
chown -R coder:coder /home/coder
echo "✓ Home directory verified"

# Add coder to docker group if it exists
if getent group docker >/dev/null 2>&1; then
    if ! groups coder | grep -q docker; then
        usermod -aG docker coder
        echo "✓ Added coder to docker group"
    fi
else
    echo "ℹ Docker group not found (will be added when Docker is installed)"
fi

echo "=== User setup complete ==="
