#!/usr/bin/env bash
# 02-wireguard-install.sh — Load WireGuard kernel module and start WireGuard Proxy stack
#
# Loads the wireguard kernel module, verifies it is active, then starts
# the WireGuard + Nginx Proxy Manager stack using Docker Compose.

set -euo pipefail

log_info "=== Installing WireGuard Proxy ==="

# Verify Docker is running
if ! systemctl is-active --quiet docker; then
    log_error "Docker is not running. Ensure 01-docker-install.sh completed successfully."
    exit 1
fi
log_info "✓ Docker daemon is running"

# Load the WireGuard kernel module
log_info "Loading WireGuard kernel module..."
if modprobe wireguard; then
    log_info "✓ WireGuard kernel module loaded"
else
    log_error "✗ Failed to load WireGuard kernel module."
    log_error "  Ensure the container is privileged (TEMPLATE_UNPRIVILEGED=0) and"
    log_error "  the host kernel has WireGuard support (Linux 5.6+ or wireguard-dkms)."
    exit 1
fi

# Verify module is active
if lsmod | grep -q '^wireguard'; then
    log_info "✓ WireGuard module is active in kernel"
else
    log_error "✗ WireGuard module was not found in lsmod after modprobe"
    exit 1
fi

# Persist the module load across reboots
if ! grep -q wireguard /etc/modules 2>/dev/null; then
    echo "wireguard" >> /etc/modules
    log_info "✓ WireGuard module added to /etc/modules for persistence"
fi

# Verify compose file is present
COMPOSE_FILE="/opt/wireguard-proxy/docker-compose.yaml"
if [[ ! -f "$COMPOSE_FILE" ]]; then
    log_error "✗ Compose file not found at ${COMPOSE_FILE}"
    log_error "  Ensure the file was copied during provisioning."
    exit 1
fi
log_info "✓ Compose file found at ${COMPOSE_FILE}"

# Create persistent data directories for Nginx Proxy Manager
mkdir -p /mnt/npm/data /mnt/npm/letsencrypt
log_info "✓ Nginx Proxy Manager data directories created at /mnt/npm/"

# Start the WireGuard Proxy stack
log_info "Starting WireGuard Proxy stack (Nginx Proxy Manager)..."
if docker compose -f "${COMPOSE_FILE}" up -d; then
    log_info "✓ WireGuard Proxy stack started successfully"
else
    log_error "✗ Failed to start WireGuard Proxy stack"
    exit 1
fi

# Determine host IP for access URL
HOST_IP=$(hostname -I | awk '{print $1}')

log_info "=== WireGuard Proxy Installation Complete ==="
log_info "Nginx Proxy Manager admin UI: http://${HOST_IP}:81"
log_info "Default credentials: admin@example.com / changeme"
log_info "HTTP proxy: http://${HOST_IP}:80"
log_info "HTTPS proxy: https://${HOST_IP}:443"
