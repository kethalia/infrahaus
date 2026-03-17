#!/usr/bin/env bash
# run-scripts.sh — Install OpenClaw Desktop software on a bootstrapped VM
#
# Usage:
#   ./run-scripts.sh <VM_IP>                  Run all scripts in order
#   ./run-scripts.sh <VM_IP> <script_name>    Run a single script
#
# Prerequisites:
#   - VM created by create-vm.sh (cloud-init bootstrap complete)
#   - VM accessible via SSH (port 22)
#   - SSH key configured OR password auth enabled
#
# SSH: Tries root first, falls back to 'openclaw' user with passwordless sudo.
# The openclaw user is configured with NOPASSWD:ALL by cloud-init.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_DIR="${SCRIPT_DIR}/scripts"
REMOTE_DIR="/tmp/openclaw-setup"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

usage() {
  echo "Usage: $0 <VM_IP> [script_name]"
  echo ""
  echo "  VM_IP        IP address of the target VM"
  echo "  script_name  Optional: run only this script (e.g. 05-vnc-setup.sh)"
  echo ""
  echo "Examples:"
  echo "  $0 192.168.1.100"
  echo "  $0 192.168.1.100 05-vnc-setup.sh"
  exit 1
}

[[ $# -lt 1 ]] && usage

VM_IP="$1"
SINGLE_SCRIPT="${2:-}"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o BatchMode=yes"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  OpenClaw Desktop — Script Runner${NC}"
echo -e "${BLUE}============================================${NC}"
echo "Target: ${VM_IP}"
echo ""

# ---------------------------------------------------------------------------
# Determine SSH user: try root first, fall back to openclaw.
# Debian 13 cloud images often disable root SSH by default. The openclaw user
# has passwordless sudo (configured by cloud-init), so scripts run as root
# either way. When using openclaw, we prefix commands with "sudo".
# ---------------------------------------------------------------------------
SSH_USER=""
SUDO_PREFIX=""

echo -n "Testing SSH as root... "
if ssh ${SSH_OPTS} root@"${VM_IP}" "echo ok" >/dev/null 2>&1; then
  SSH_USER="root"
  SUDO_PREFIX=""
  echo -e "${GREEN}OK${NC}"
else
  echo -e "${YELLOW}root login failed${NC}"
  echo -n "Falling back to openclaw user... "
  if ssh ${SSH_OPTS} openclaw@"${VM_IP}" "echo ok" >/dev/null 2>&1; then
    SSH_USER="openclaw"
    SUDO_PREFIX="sudo"
    echo -e "${GREEN}OK${NC}"
    info "Using openclaw user with passwordless sudo"
  else
    error "Cannot connect to ${VM_IP} as root or openclaw."
    echo ""
    echo "Troubleshooting:"
    echo "  1. Ensure VM is running and cloud-init has completed (~2-3 min after start)"
    echo "  2. Check VM IP:  qm agent <VMID> network-get-interfaces"
    echo "  3. Test SSH manually:  ssh root@${VM_IP}"
    echo "  4. Check cloud-init:  qm agent <VMID> exec -- cat /var/log/cloud-init-output.log"
    exit 1
  fi
fi

SSH_CMD="ssh ${SSH_OPTS} ${SSH_USER}@${VM_IP}"
SCP_CMD="scp ${SSH_OPTS/-o BatchMode=yes/}"

echo ""

# Create remote staging directory
${SSH_CMD} "${SUDO_PREFIX} mkdir -p ${REMOTE_DIR} && ${SUDO_PREFIX} chmod 755 ${REMOTE_DIR}"

# Copy all scripts to the VM
info "Copying scripts to VM (${REMOTE_DIR})..."
${SCP_CMD} "${SCRIPTS_DIR}"/*.sh "${SSH_USER}@${VM_IP}:${REMOTE_DIR}/"
${SSH_CMD} "${SUDO_PREFIX} chmod +x ${REMOTE_DIR}/*.sh"
info "Scripts copied."
echo ""

# Determine which scripts to run
if [[ -n "$SINGLE_SCRIPT" ]]; then
  SCRIPTS=("${SINGLE_SCRIPT}")
else
  mapfile -t SCRIPTS < <(ls -1 "${SCRIPTS_DIR}"/*.sh | xargs -I{} basename {} | sort)
fi

# Execute scripts in order
FAILED=0
TOTAL=${#SCRIPTS[@]}

for script in "${SCRIPTS[@]}"; do
  echo -e "--- Running ${YELLOW}${script}${NC} ---"

  if ${SSH_CMD} "${SUDO_PREFIX} bash ${REMOTE_DIR}/${script}"; then
    echo -e "${GREEN}[OK] ${script}${NC}"
  else
    EXIT_CODE=$?
    echo -e "${RED}[FAILED] ${script} (exit ${EXIT_CODE})${NC}"
    FAILED=$((FAILED + 1))

    if [[ -z "$SINGLE_SCRIPT" ]]; then
      echo ""
      read -rp "Continue with remaining scripts? [Y/n] " reply
      if [[ "${reply,,}" == "n" ]]; then
        warn "Aborted after ${script}."
        break
      fi
    fi
  fi
  echo ""
done

# Cleanup remote staging directory
${SSH_CMD} "rm -rf ${REMOTE_DIR}" 2>/dev/null || true

echo -e "${BLUE}============================================${NC}"
if [[ $FAILED -eq 0 ]]; then
  echo -e "${GREEN}All ${TOTAL} scripts completed successfully!${NC}"
else
  echo -e "${YELLOW}${FAILED} of ${TOTAL} scripts failed. Review output above.${NC}"
  echo ""
  echo "To re-run a specific script after fixing an issue:"
  echo "  $0 ${VM_IP} <script_name>"
fi
echo -e "${BLUE}============================================${NC}"
