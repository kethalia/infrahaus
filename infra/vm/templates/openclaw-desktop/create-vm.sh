#!/usr/bin/env bash
# OpenClaw Desktop VM Creator
# Creates a Debian 13 VM with minimal cloud-init bootstrap.
# After creation, run ./run-scripts.sh <VM_IP> to install desktop software.
#
# Usage: bash create-vm.sh
# Must be run on the Proxmox host as root.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load template defaults (all TEMPLATE_* vars, overridable via env)
source "${SCRIPT_DIR}/template.conf"

echo "============================================"
echo "  OpenClaw Desktop VM Creator"
echo "============================================"
echo ""
echo "Phase 1 — This script:"
echo "  Creates Debian 13 VM via ProxmoxVE community script"
echo "  Cloud-init: openclaw user, SSH, prerequisite packages"
echo ""
echo "Phase 2 — After VM boots (run separately):"
echo "  ./run-scripts.sh <VM_IP>  — installs full desktop"
echo "  Installs: XFCE, Chrome, Node.js 22, TigerVNC, OpenClaw"
echo ""
echo "Resources: ${TEMPLATE_CPU} cores, ${TEMPLATE_RAM}MB RAM, ${TEMPLATE_DISK} disk"
echo ""

# Pre-set env vars that the community script may read.
# NOTE: Community VM scripts use whiptail dialogs and may not honor all vars.
# Users can adjust values in the interactive dialog if these don't take effect.
export var_cpu="${TEMPLATE_CPU}"
export var_ram="${TEMPLATE_RAM}"
export DISK_SIZE="${TEMPLATE_DISK}"
export HN="${TEMPLATE_HOSTNAME}"
export START_VM="${TEMPLATE_START_VM}"

echo "Launching ProxmoxVE community script for base Debian 13 VM..."
echo "(Accept defaults or customize in the whiptail dialog)"
echo ""

# Run in bash -c subshell (intentional — community VM scripts are whiptail-interactive
# and cannot be sourced the way LXC scripts can. Tradeoff: $VMID is not accessible
# from the subshell, so we detect the created VM by hostname after this completes.)
bash -c "$(curl -fsSL https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main/vm/debian-13-vm.sh)"

echo ""
echo "Community script finished. Detecting created VM by hostname..."

# Detect the VM created by the community script.
# We search qm list for our hostname since $VMID is not available from the subshell.
VMID=$(qm list | awk -v h="${TEMPLATE_HOSTNAME}" '$2 == h {print $1}' | tail -1)

if [[ -z "$VMID" ]]; then
  echo "ERROR: Could not find VM with hostname '${TEMPLATE_HOSTNAME}'."
  echo ""
  echo "Current VMs:"
  qm list
  echo ""
  echo "If the VM was created with a different hostname, run:"
  echo "  qm set <VMID> --name ${TEMPLATE_HOSTNAME}"
  echo "  Then re-run this script, or apply cloud-init manually."
  exit 1
fi

echo "Found VM: ${VMID} (${TEMPLATE_HOSTNAME})"

# Deploy cloud-init config to Proxmox snippets storage
SNIPPETS_DIR="/var/lib/vz/snippets"
mkdir -p "${SNIPPETS_DIR}"

CLOUD_INIT_SRC="${SCRIPT_DIR}/cloud-init/user-data.yaml"
SNIPPET_FILE="openclaw-desktop-${VMID}.yaml"

if [[ ! -f "${CLOUD_INIT_SRC}" ]]; then
  echo "ERROR: Cloud-init config not found at ${CLOUD_INIT_SRC}"
  exit 1
fi

cp "${CLOUD_INIT_SRC}" "${SNIPPETS_DIR}/${SNIPPET_FILE}"
echo "Cloud-init config -> ${SNIPPETS_DIR}/${SNIPPET_FILE}"

# Apply cloud-init and display settings to the VM
qm set "${VMID}" --cicustom "user=local:snippets/${SNIPPET_FILE}"
qm set "${VMID}" --vga "${TEMPLATE_DISPLAY}"
echo "Cloud-init and display settings applied."

# Restart VM to pick up cloud-init config (if already running from community script)
if qm status "${VMID}" | grep -q "running"; then
  echo "VM is running. Restarting to apply cloud-init..."
  qm shutdown "${VMID}" --timeout 30 2>/dev/null || qm stop "${VMID}"
  sleep 2
  qm start "${VMID}"
  echo "VM restarted."
elif [[ "${TEMPLATE_START_VM}" == "yes" ]]; then
  echo "Starting VM ${VMID}..."
  qm start "${VMID}"
fi

# NOTE: VM intentionally stays running. Do NOT convert to template via `qm template`.
# The VM is immediately usable. If cloning is needed later, the user can run:
#   qm template ${VMID}

echo ""
echo "============================================"
echo "  VM Created: ${VMID} (${TEMPLATE_HOSTNAME})"
echo "============================================"
echo ""
echo "Cloud-init is bootstrapping the VM (~2-3 minutes)."
echo "Monitor progress (from Proxmox host):"
echo "  qm agent ${VMID} exec -- cat /var/log/cloud-init-output.log"
echo ""
echo "When SSH is available, install desktop software:"
echo "  1. Get IP:  qm agent ${VMID} network-get-interfaces"
echo "  2. Run:     ./run-scripts.sh <VM_IP>"
echo ""
echo "Default credentials:"
echo "  SSH:      openclaw / openclaw  (must change on first login)"
echo "  VNC:      port 5901, password: openclaw  (set by scripts)"
echo "============================================"
