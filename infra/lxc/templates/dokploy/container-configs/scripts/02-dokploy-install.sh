#!/usr/bin/env bash
# 02-dokploy-install.sh — Install and start Dokploy via Docker Swarm
#
# Initializes Docker Swarm, creates the dokploy-network overlay network,
# and starts the Dokploy stack using the compose file at /opt/dokploy/.

set -euo pipefail

log_info "=== Installing Dokploy ==="

# Verify Docker is running
if ! systemctl is-active --quiet docker; then
    log_error "Docker is not running. Ensure 01-docker-install.sh completed successfully."
    exit 1
fi
log_info "✓ Docker daemon is running"

# Check ports 80 and 443 are free (required by Traefik)
log_info "Checking ports 80 and 443 are available..."
if ss -tulnp | grep -q ':80 '; then
    log_error "✗ Port 80 is already in use. Dokploy requires port 80 to be free."
    exit 1
fi
log_info "✓ Port 80 is free"

if ss -tulnp | grep -q ':443 '; then
    log_error "✗ Port 443 is already in use. Dokploy requires port 443 to be free."
    exit 1
fi
log_info "✓ Port 443 is free"

# Initialize Docker Swarm if not already initialized
log_info "Checking Docker Swarm status..."
if docker info 2>/dev/null | grep -q 'Swarm: active'; then
    log_info "✓ Docker Swarm is already active — skipping init"
else
    log_info "Initializing Docker Swarm..."
    # Determine advertise address
    ADVERTISE_ADDR="${ADVERTISE_ADDR:-}"
    if [[ -z "$ADVERTISE_ADDR" ]]; then
        ADVERTISE_ADDR=$(curl -4s --connect-timeout 5 https://ifconfig.io 2>/dev/null || \
                         curl -4s --connect-timeout 5 https://icanhazip.com 2>/dev/null || \
                         ip route get 1 | awk '{print $7; exit}' 2>/dev/null || \
                         echo "127.0.0.1")
    fi
    log_info "Using advertise address: ${ADVERTISE_ADDR}"
    if ! docker swarm init --advertise-addr "${ADVERTISE_ADDR}"; then
        log_error "✗ Failed to initialize Docker Swarm"
        exit 1
    fi
    log_info "✓ Docker Swarm initialized"
fi

# Create dokploy-network overlay if it doesn't exist
if docker network ls --format '{{.Name}}' | grep -q '^dokploy-network$'; then
    log_info "✓ dokploy-network already exists — skipping creation"
else
    log_info "Creating dokploy-network overlay network..."
    docker network create --driver overlay --attachable dokploy-network
    log_info "✓ dokploy-network created"
fi

# Ensure the /etc/dokploy directory exists
mkdir -p /etc/dokploy
chmod 777 /etc/dokploy
log_info "✓ /etc/dokploy directory ready"

# Verify compose file is present
COMPOSE_FILE="/opt/dokploy/docker-compose.yaml"
if [[ ! -f "$COMPOSE_FILE" ]]; then
    log_error "✗ Compose file not found at ${COMPOSE_FILE}"
    log_error "  Ensure the file was copied during provisioning."
    exit 1
fi
log_info "✓ Compose file found at ${COMPOSE_FILE}"

# Pull images and start Dokploy stack
log_info "Starting Dokploy stack (this may take a few minutes)..."
if docker compose -f "${COMPOSE_FILE}" up -d; then
    log_info "✓ Dokploy stack started successfully"
else
    log_error "✗ Failed to start Dokploy stack"
    exit 1
fi

# Determine host IP for access URL
HOST_IP="${ADVERTISE_ADDR:-$(hostname -I | awk '{print $1}')}"

log_info "=== Dokploy Installation Complete ==="
log_info "Dokploy is starting up. Wait ~15 seconds for all services to be ready."
log_info "Access Dokploy at: http://${HOST_IP}:3000"
