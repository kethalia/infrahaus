#!/usr/bin/env bash
set -euo pipefail
# pre-deploy.sh -- Pre-deployment validation for forge-shield template
# Runs ON THE PROXMOX HOST before container creation.
# The container does not exist yet when this hook runs.

echo "[pre-deploy] Starting forge-shield pre-deployment checks..."

# Validate required environment variables
: "${CTID:?[pre-deploy] ERROR: CTID is not set}"
: "${STORAGE:?[pre-deploy] ERROR: STORAGE is not set}"

# Check that the OS template file exists
echo "[pre-deploy] Checking OS template availability..."
if ! ls /var/lib/vz/template/cache/ubuntu-24.04-*.tar.zst &>/dev/null; then
    echo "[pre-deploy] ERROR: Ubuntu 24.04 OS template not found in /var/lib/vz/template/cache/"
    echo "[pre-deploy] Download with: pveam download local ubuntu-24.04-standard_24.04-2_amd64.tar.zst"
    exit 1
fi
echo "[pre-deploy]   OS template: OK"

# Check that the storage target exists and is available
echo "[pre-deploy] Checking storage availability..."
if ! pvesm status | grep -q "^${STORAGE}"; then
    echo "[pre-deploy] ERROR: Storage '${STORAGE}' not found or unavailable"
    echo "[pre-deploy] Available storage:"
    pvesm status
    exit 1
fi
echo "[pre-deploy]   Storage '${STORAGE}': OK"

# Check that the VMID is not already in use
echo "[pre-deploy] Checking VMID availability..."
if pct status "${CTID}" &>/dev/null; then
    echo "[pre-deploy] ERROR: VMID ${CTID} already exists"
    exit 1
fi
echo "[pre-deploy]   VMID ${CTID}: available"

# Log available disk space on host storage
echo "[pre-deploy] Checking available disk space..."
df -h /var/lib/vz/ | tail -1 | awk '{print "[pre-deploy]   Disk space: " $4 " available of " $2 " total (" $5 " used)"}'

echo "[pre-deploy] All pre-deploy host checks passed"
