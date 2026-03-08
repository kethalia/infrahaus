#!/usr/bin/env bash
# 00-pre-checks.sh — Environment validation before any installation
#
# Verifies the VM is ready for setup: root, Debian 13, resources, network.
# Run this first before any other script.
#
# Usage: sudo ./00-pre-checks.sh

set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

info "=== Pre-Flight Checks ==="

# ---------------------------------------------------------------------------
# 1. Root check
# ---------------------------------------------------------------------------
if [[ $EUID -ne 0 ]]; then
    error "This script must be run as root. Try: sudo $0"
    exit 1
fi
info "Running as root."

# ---------------------------------------------------------------------------
# 2. Debian 13 (Trixie) check
# ---------------------------------------------------------------------------
if [[ ! -f /etc/os-release ]]; then
    error "/etc/os-release not found. Cannot determine OS."
    exit 1
fi

# shellcheck source=/dev/null
source /etc/os-release

if [[ "${ID:-}" != "debian" ]]; then
    error "OS is '${ID:-unknown}', expected 'debian'. These scripts are Debian-specific."
    exit 1
fi

if [[ "${VERSION_ID:-}" != "13" && "${VERSION_CODENAME:-}" != "trixie" ]]; then
    error "Debian version is '${VERSION_ID:-unknown}' (${VERSION_CODENAME:-unknown}), expected Debian 13 (trixie)."
    error "These scripts target Debian 13 specifically."
    exit 1
fi

info "OS: ${PRETTY_NAME:-Debian 13}"

# ---------------------------------------------------------------------------
# 3. Resource checks (warn only — user may be testing on minimal resources)
# ---------------------------------------------------------------------------
TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_MEM_MB=$((TOTAL_MEM_KB / 1024))
if [[ $TOTAL_MEM_MB -lt 2048 ]]; then
    warn "RAM is ${TOTAL_MEM_MB} MB (recommended: 2048 MB). Some operations may be slow."
else
    info "RAM: ${TOTAL_MEM_MB} MB"
fi

DISK_AVAIL_GB=$(df -BG / | tail -1 | awk '{print $4}' | sed 's/G//')
if [[ $DISK_AVAIL_GB -lt 10 ]]; then
    warn "Free disk space on / is ${DISK_AVAIL_GB} GB (recommended: 10 GB)."
else
    info "Disk free: ${DISK_AVAIL_GB} GB"
fi

CPU_CORES=$(nproc)
info "CPU cores: ${CPU_CORES}"

# ---------------------------------------------------------------------------
# 4. Network check — required for all subsequent scripts
# ---------------------------------------------------------------------------
info "Checking network connectivity..."

_net_ok=false
# Check deb.nodesource.com specifically (NodeSource is required by 03-nodejs-setup.sh)
if curl -fsSL --max-time 5 https://deb.nodesource.com/ > /dev/null 2>&1; then
    _net_ok=true
fi

# Fallback: ping 8.8.8.8
if [[ "$_net_ok" == false ]]; then
    if ping -c 1 -W 3 8.8.8.8 > /dev/null 2>&1; then
        _net_ok=true
    fi
fi

if [[ "$_net_ok" == false ]]; then
    error "Network check failed. Internet access is required for all setup scripts."
    error "Check your VM network configuration and try again."
    exit 1
fi

info "Network: OK"

# ---------------------------------------------------------------------------
# 5. Print system summary
# ---------------------------------------------------------------------------
KERNEL=$(uname -r)

info "=== System Summary ==="
info "  OS:      ${PRETTY_NAME:-Debian 13}"
info "  Kernel:  ${KERNEL}"
info "  RAM:     ${TOTAL_MEM_MB} MB"
info "  Disk:    ${DISK_AVAIL_GB} GB free on /"
info "  CPUs:    ${CPU_CORES}"

info "=== Pre-Flight Checks Complete — System ready for setup ==="
