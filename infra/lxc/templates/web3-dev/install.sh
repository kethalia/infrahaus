#!/usr/bin/env bash
# shellcheck disable=SC1090,SC2034,SC2154
# SC1090: Dynamic sourcing required for ProxmoxVE framework
# SC2034: ProxmoxVE framework variables used externally
# SC2154: ProxmoxVE framework provides these variables

# Generic LXC container installation script
# All template-specific configuration should be in container-configs/

# Copyright (c) 2026 kethalia  
# Author: kethalia
# License: MIT | https://github.com/kethalia/pve-home-lab/raw/main/LICENSE
# Source: https://github.com/kethalia/pve-home-lab

source /dev/stdin <<<"$FUNCTIONS_FILE_PATH"
color
verb_ip6
catch_errors
setting_up_container
network_check
update_os

# Configuration (can be overridden via environment variables)
REPO_URL="${REPO_URL:-https://github.com/kethalia/pve-home-lab.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
CONFIG_PATH="${CONFIG_PATH:-infra/lxc/templates/web3-dev/container-configs}"

msg_info "Installing config-manager service"
INSTALL_SCRIPT="$(mktemp -t install-config-manager.XXXXXX.sh)"

# Download the config-manager installer from repository
if ! curl -fsSL --max-time 60 -A "ProxmoxVE-Script/1.0" \
    "https://raw.githubusercontent.com/kethalia/pve-home-lab/main/infra/lxc/scripts/config-manager/install-config-manager.sh" \
    -o "${INSTALL_SCRIPT}"; then
  msg_error "Failed to download config-manager installer"
  rm -f "${INSTALL_SCRIPT}"
  exit 1
fi

# Verify that the installer script was successfully obtained
if [[ ! -f "${INSTALL_SCRIPT}" ]] || [[ ! -s "${INSTALL_SCRIPT}" ]]; then
  msg_error "Config-manager installer is empty or missing"
  rm -f "${INSTALL_SCRIPT}"
  exit 1
fi

if ! chmod +x "${INSTALL_SCRIPT}"; then
  msg_error "Failed to make installer executable"
  rm -f "${INSTALL_SCRIPT}"
  exit 1
fi

# Install and run config-manager
# All template-specific setup will be handled by container-configs/
msg_info "Running config-manager with template configuration"
if ! bash "${INSTALL_SCRIPT}" \
  --repo-url "${REPO_URL}" \
  --branch "${REPO_BRANCH}" \
  --config-path "${CONFIG_PATH}" \
  --run; then
  msg_error "Config-manager installation failed"
  rm -f "${INSTALL_SCRIPT}"
  exit 1
fi

rm -f "${INSTALL_SCRIPT}"
msg_ok "Config-manager installed and initial sync completed"

# ProxmoxVE standard finalizations
msg_info "Configuring SSH access"
motd_ssh
msg_ok "SSH access configured"

msg_info "Applying ProxmoxVE customizations"
customize
msg_ok "Customizations applied"

msg_info "Cleaning up container"
cleanup_lxc
msg_ok "Container cleanup completed"

# Display completion message
msg_ok "Container setup complete!"
echo -e "${CREATING}${GN}===========================================${CL}"
echo -e "${CREATING}${GN}  LXC Container Ready!${CL}"
echo -e "${CREATING}${GN}===========================================${CL}"
echo -e ""
echo -e "${INFO}${YW}Configuration applied from:${CL}"
echo -e "${TAB}Repository: ${BGN}${REPO_URL}${CL}"
echo -e "${TAB}Branch: ${BGN}${REPO_BRANCH}${CL}"
echo -e "${TAB}Path: ${BGN}${CONFIG_PATH}${CL}"
echo -e ""
echo -e "${INFO}${YW}Container IP:${CL} ${BGN}${IP}${CL}"
echo -e ""
echo -e "${INFO}${YW}Config Management:${CL}"
echo -e "${TAB}• Manual sync: ${BGN}sudo systemctl restart config-manager${CL}"
echo -e "${TAB}• View logs: ${BGN}journalctl -u config-manager -f${CL}"
echo -e "${TAB}• Rollback: ${BGN}config-rollback list${CL}"
echo -e ""
echo -e "${WARN}${RD}Note:${CL} Check container-specific documentation for access details"
