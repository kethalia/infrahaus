#!/usr/bin/env bash
# deploy.sh — Main entry point for the LXC container template engine
#
# Usage: deploy.sh <template-name> [OPTIONS]
#
# This script orchestrates the full LXC container deployment pipeline:
#   validate -> pre-deploy hook -> create -> start -> packages -> files
#   -> scripts -> user packages -> env -> post-deploy hook -> summary
#
# Run on the Proxmox host as root.

set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve engine paths
# ---------------------------------------------------------------------------
ENGINE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_ROOT="$(dirname "$ENGINE_DIR")"

# ---------------------------------------------------------------------------
# Source all 6 library files
# ---------------------------------------------------------------------------
# shellcheck source=lib/logging.sh
source "$ENGINE_DIR/lib/logging.sh"
# shellcheck source=lib/config.sh
# (config.sh requires TEMPLATE_DIR to be set — will be set after arg parsing)
# shellcheck source=lib/state.sh
source "$ENGINE_DIR/lib/state.sh"
# shellcheck source=lib/container.sh
source "$ENGINE_DIR/lib/container.sh"
# shellcheck source=lib/files.sh
source "$ENGINE_DIR/lib/files.sh"
# shellcheck source=lib/hooks.sh
source "$ENGINE_DIR/lib/hooks.sh"

# ---------------------------------------------------------------------------
# Globals set by argument parsing
# ---------------------------------------------------------------------------
TEMPLATE_NAME=""
TEMPLATE_DIR=""
TEMPLATE_YAML=""

# CLI override flags (empty = not set, use YAML or default)
CLI_VMID=""
CLI_HOSTNAME=""
CLI_CORES=""
CLI_MEMORY=""
CLI_IP=""
CLI_GATEWAY=""
CLI_STORAGE=""

# Behaviour flags
DRY_RUN=false
DESTROY=false
RESUME=false
FORCE=false
VERBOSE=false

# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------
usage() {
  cat >&2 <<EOF
Usage: $(basename "$0") <template-name> [OPTIONS]

  <template-name>   Name of the template directory under ${TEMPLATES_ROOT}/
                    Example: forge-shield

Options:
  --vmid N          Override container VMID
  --hostname NAME   Override container hostname
  --cores N         Override number of CPU cores
  --memory N        Override memory in MB
  --ip ADDR         Override IP address (e.g. 192.168.1.200/24 or dhcp)
  --gateway ADDR    Override default gateway
  --storage NAME    Override storage backend (default: local-lvm)
  --force           Destroy existing container (if any) and redeploy
  --dry-run         Show resolved config and planned actions; do not execute
  --destroy         Destroy the container with the resolved VMID and exit
  --resume          Resume deployment from the last completed step
  --verbose         Enable debug-level logging
  --help            Show this help message and exit

Examples:
  $(basename "$0") forge-shield
  $(basename "$0") forge-shield --vmid 200 --ip 192.168.1.200/24 --gateway 192.168.1.1
  $(basename "$0") forge-shield --dry-run
  $(basename "$0") forge-shield --destroy --vmid 200
  $(basename "$0") forge-shield --resume

EOF
  exit 0
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
parse_args() {
  if [[ $# -eq 0 ]]; then
    log_error "No template name provided."
    usage
  fi

  # First positional argument is the template name
  # (allow --help before template name)
  if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    usage
  fi

  TEMPLATE_NAME="$1"
  shift

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --vmid)      CLI_VMID="$2";     shift 2 ;;
      --hostname)  CLI_HOSTNAME="$2"; shift 2 ;;
      --cores)     CLI_CORES="$2";    shift 2 ;;
      --memory)    CLI_MEMORY="$2";   shift 2 ;;
      --ip)        CLI_IP="$2";       shift 2 ;;
      --gateway)   CLI_GATEWAY="$2";  shift 2 ;;
      --storage)   CLI_STORAGE="$2";  shift 2 ;;
      --force)     FORCE=true;        shift ;;
      --dry-run)   DRY_RUN=true;      shift ;;
      --destroy)   DESTROY=true;      shift ;;
      --resume)    RESUME=true;       shift ;;
      --verbose)   VERBOSE=true;      shift ;;
      --help|-h)   usage ;;
      *)
        log_error "Unknown option: $1"
        usage
        ;;
    esac
  done

  if [[ "$VERBOSE" == true ]]; then LOG_LEVEL="debug"; fi
}

# ---------------------------------------------------------------------------
# Validation phase
# ---------------------------------------------------------------------------
validate() {
  # 1. Template name and directory
  if [[ -z "$TEMPLATE_NAME" ]]; then
    log_error "Template name is required."
    usage
  fi

  TEMPLATE_DIR="${TEMPLATES_ROOT}/${TEMPLATE_NAME}"
  if [[ ! -d "$TEMPLATE_DIR" ]]; then
    log_error "Template directory not found: $TEMPLATE_DIR"
    exit 1
  fi

  # 2. template.yaml
  TEMPLATE_YAML="${TEMPLATE_DIR}/template.yaml"
  if [[ ! -f "$TEMPLATE_YAML" ]]; then
    log_error "template.yaml not found in $TEMPLATE_DIR"
    exit 1
  fi

  # 3. Source config.sh now that TEMPLATE_DIR / TEMPLATE_YAML are set
  # shellcheck source=lib/config.sh
  source "$ENGINE_DIR/lib/config.sh"

  # 4. Check yq — try to install if missing, but only fail on real deployments
  if ! command -v yq &>/dev/null; then
    if [[ "$DRY_RUN" == false && "$DESTROY" == false ]]; then
      log_warn "yq not found. Attempting to install from GitHub releases..."
      install_yq
    else
      log_warn "yq not found. Install it before deploying: https://github.com/mikefarah/yq"
      # For dry-run/destroy, we still need yq to read template.yaml
      # Try a best-effort install; if it fails, continue anyway
      install_yq 2>/dev/null || log_warn "yq installation skipped (non-root). Config defaults will be used."
    fi
  fi

  # 5. Check running as root (skip for --help and --dry-run)
  if [[ "$DRY_RUN" == false && "$DESTROY" == false ]] && [[ "$(id -u)" -ne 0 ]]; then
    log_error "deploy.sh must be run as root (pct commands require root on the Proxmox host)."
    exit 1
  fi

  # 6. Resolve config with CLI > YAML > defaults
  resolve_config

  # 7. Set DEPLOY_STATE_FILE for state.sh
  DEPLOY_STATE_FILE="${TEMPLATE_DIR}/.deploy-state"

  # 8. --destroy action
  if [[ "$DESTROY" == true ]]; then
    if [[ -z "$CTID" ]]; then
      log_error "--destroy requires a VMID (via --vmid or .container.vmid in template.yaml)"
      exit 1
    fi
    log_step "Destroying container $CTID..."
    if ct_exists "$CTID"; then
      ct_destroy "$CTID"
      log_success "Container $CTID destroyed."
    else
      log_warn "Container $CTID does not exist."
    fi
    exit 0
  fi

  # 9. --resume: check state file
  if [[ "$RESUME" == true ]]; then
    if [[ ! -f "$DEPLOY_STATE_FILE" ]]; then
      log_error "--resume specified but no .deploy-state file found at $DEPLOY_STATE_FILE"
      exit 1
    fi
    log_info "Resuming deployment from saved state..."
  fi
}

# ---------------------------------------------------------------------------
# Install yq if missing
# ---------------------------------------------------------------------------
install_yq() {
  local yq_url="https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64"
  # Install to /usr/local/bin if root, otherwise try ~/bin
  local yq_dest
  if [[ "$(id -u)" -eq 0 ]]; then
    yq_dest="/usr/local/bin/yq"
  else
    mkdir -p "$HOME/bin"
    yq_dest="$HOME/bin/yq"
    export PATH="$HOME/bin:$PATH"
  fi

  if command -v wget &>/dev/null; then
    wget -qO "$yq_dest" "$yq_url" && chmod +x "$yq_dest"
  elif command -v curl &>/dev/null; then
    curl -sL "$yq_url" -o "$yq_dest" && chmod +x "$yq_dest"
  else
    log_error "Cannot install yq: neither wget nor curl is available."
    exit 1
  fi

  if ! command -v yq &>/dev/null; then
    log_error "yq installation failed. Please install yq manually: https://github.com/mikefarah/yq"
    exit 1
  fi
  log_success "yq installed at $yq_dest"
}

# ---------------------------------------------------------------------------
# Config resolution — CLI > template.yaml > defaults
# ---------------------------------------------------------------------------
resolve_config() {
  # VMID
  local yaml_vmid
  yaml_vmid=$(cfg_get '.container.vmid')
  if [[ -n "$CLI_VMID" ]]; then
    CTID="$CLI_VMID"
  elif [[ -n "$yaml_vmid" ]]; then
    CTID="$yaml_vmid"
  else
    # Auto-assign only when not --dry-run (pvesh not available in dry-run context)
    if [[ "$DRY_RUN" == false ]]; then
      CTID=$(ct_next_id)
    else
      CTID="<auto>"
    fi
  fi

  # HOSTNAME
  local yaml_hostname
  yaml_hostname=$(cfg_get '.container.hostname')
  if [[ -n "$CLI_HOSTNAME" ]]; then
    HOSTNAME_CT="$CLI_HOSTNAME"
  elif [[ -n "$yaml_hostname" ]]; then
    HOSTNAME_CT="$yaml_hostname"
  else
    HOSTNAME_CT="$TEMPLATE_NAME"
  fi

  # CORES
  local yaml_cores
  yaml_cores=$(cfg_get '.container.cores')
  CORES="${CLI_CORES:-${yaml_cores:-2}}"

  # MEMORY (MB)
  local yaml_memory
  yaml_memory=$(cfg_get '.container.memory')
  MEMORY="${CLI_MEMORY:-${yaml_memory:-2048}}"

  # SWAP (MB)
  SWAP=$(cfg_get_default '.container.swap' '512')

  # DISK (GB)
  DISK=$(cfg_get_default '.container.disk' '8')

  # STORAGE
  local yaml_storage
  yaml_storage=$(cfg_get '.container.storage')
  STORAGE="${CLI_STORAGE:-${yaml_storage:-local-lvm}}"

  # OSTEMPLATE
  OSTEMPLATE=$(cfg_get_default '.container.ostemplate' \
    'local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst')

  # IP
  local yaml_ip
  yaml_ip=$(cfg_get '.container.network.ip')
  IP="${CLI_IP:-${yaml_ip:-dhcp}}"

  # GATEWAY
  local yaml_gateway
  yaml_gateway=$(cfg_get '.container.network.gateway')
  GATEWAY="${CLI_GATEWAY:-${yaml_gateway:-}}"

  # BRIDGE
  BRIDGE=$(cfg_get_default '.container.network.bridge' 'vmbr0')

  # UNPRIVILEGED
  local yaml_unpriv
  yaml_unpriv=$(cfg_get '.container.unprivileged')
  UNPRIVILEGED="${yaml_unpriv:-true}"
  # Normalise to 1/0 for pct
  [[ "$UNPRIVILEGED" == "true" || "$UNPRIVILEGED" == "1" ]] && UNPRIVILEGED_FLAG=1 || UNPRIVILEGED_FLAG=0

  # FEATURES (joined with comma)
  local yaml_features
  yaml_features=$(cfg_get_array '.container.features' | paste -sd ',' - 2>/dev/null || true)
  FEATURES="${yaml_features:-nesting=1}"

  # USERNAME
  USERNAME=$(cfg_get_default '.user.name' 'coder')

  # USER_SHELL
  USER_SHELL=$(cfg_get_default '.user.shell' '/bin/bash')

  # TAGS (joined with semicolon for Proxmox)
  local yaml_tags
  yaml_tags=$(cfg_get_array '.container.tags' | paste -sd ';' - 2>/dev/null || true)
  TAGS="${yaml_tags:-}"

  # DNS (optional)
  NAMESERVER=$(cfg_get '.container.network.nameserver')
  SEARCHDOMAIN=$(cfg_get '.container.network.searchdomain')

  # Template metadata
  TEMPLATE_VERSION=$(cfg_get_default '.meta.version' '1.0.0')
  TEMPLATE_DESCRIPTION=$(cfg_get_default '.meta.description' "$TEMPLATE_NAME template")

  log_debug "=== Resolved Config ==="
  log_debug "CTID:          $CTID"
  log_debug "HOSTNAME_CT:   $HOSTNAME_CT"
  log_debug "CORES:         $CORES"
  log_debug "MEMORY:        $MEMORY MB"
  log_debug "SWAP:          $SWAP MB"
  log_debug "DISK:          $DISK GB"
  log_debug "STORAGE:       $STORAGE"
  log_debug "OSTEMPLATE:    $OSTEMPLATE"
  log_debug "IP:            $IP"
  log_debug "GATEWAY:       $GATEWAY"
  log_debug "BRIDGE:        $BRIDGE"
  log_debug "UNPRIVILEGED:  $UNPRIVILEGED_FLAG"
  log_debug "FEATURES:      $FEATURES"
  log_debug "USERNAME:      $USERNAME"
  log_debug "USER_SHELL:    $USER_SHELL"
  log_debug "TAGS:          $TAGS"
}

# ---------------------------------------------------------------------------
# Error trap
# ---------------------------------------------------------------------------
_trap_err() {
  local exit_code=$?
  local line_no="${BASH_LINENO[0]}"
  log_error "Deployment failed (exit ${exit_code}) at line ${line_no} in phase: $(state_get PHASE 2>/dev/null || echo unknown)"
  log_error "Container $CTID left in place for debugging. Use --destroy to remove it."
  log_error "Re-run with --resume to continue from the last completed step."
  exit "$exit_code"
}

# ---------------------------------------------------------------------------
# Main deployment pipeline
# ---------------------------------------------------------------------------
deploy() {
  trap '_trap_err' ERR

  # --------------------------------------------------------------------------
  # Phase 1: Pre-flight
  # --------------------------------------------------------------------------
  log_step "Phase 1: Pre-flight checks"

  if [[ "$DRY_RUN" == false ]] && ct_exists "$CTID"; then
    if [[ "$FORCE" == true ]]; then
      log_warn "Container $CTID already exists. --force specified: destroying and redeploying."
      ct_destroy "$CTID"
    else
      log_error "Container $CTID already exists."
      log_error "Use --force to destroy and redeploy, or --destroy to remove it, or --resume to continue."
      exit 1
    fi
  fi

  if [[ "$DRY_RUN" == true ]]; then
    log_step "DRY RUN — resolved configuration and planned actions:"
    echo ""
    echo "  Template:      $TEMPLATE_NAME"
    echo "  Version:       $TEMPLATE_VERSION"
    echo "  Description:   $TEMPLATE_DESCRIPTION"
    echo ""
    echo "  Container ID:  $CTID"
    echo "  Hostname:      $HOSTNAME_CT"
    echo "  Cores:         $CORES"
    echo "  Memory:        ${MEMORY} MB"
    echo "  Swap:          ${SWAP} MB"
    echo "  Disk:          ${DISK} GB on $STORAGE"
    echo "  OS template:   $OSTEMPLATE"
    echo "  Network:       IP=$IP, Gateway=${GATEWAY:-<none>}, Bridge=$BRIDGE"
    echo "  Unprivileged:  $UNPRIVILEGED_FLAG"
    echo "  Features:      $FEATURES"
    echo "  Username:      $USERNAME ($USER_SHELL)"
    echo "  Tags:          ${TAGS:-<none>}"
    echo ""
    echo "  Pipeline phases:"
    echo "    1. pre-deploy hook (on host)"
    echo "    2. pct create"
    echo "    3. pct start + wait"
    echo "    4. apt packages"
    echo "    5. push files from templates/$TEMPLATE_NAME/files/"
    echo "    6. run scripts from templates/$TEMPLATE_NAME/scripts/"
    echo "    7. user-level packages (pip/npm/cargo/go)"
    echo "    8. env configuration"
    echo "    9. post-deploy hook (in container)"
    echo "   10. summary"
    echo ""

    # List scripts that would run
    local scripts_dir="${TEMPLATE_DIR}/scripts"
    if [[ -d "$scripts_dir" ]]; then
      echo "  Scripts to execute:"
      find "$scripts_dir" -name '[0-9][0-9]_*.sh' | sort | while read -r s; do
        echo "    $(basename "$s")"
      done
      echo ""
    fi

    exit 0
  fi

  # Record start time in state
  state_init "$CTID"
  state_set "DEPLOY_STARTED" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  # --------------------------------------------------------------------------
  # Phase 2: Pre-deploy hook (on host, before container exists)
  # --------------------------------------------------------------------------
  log_step "Phase 2: Pre-deploy hook (host)"
  state_set_phase "pre_deploy"
  run_hook "$TEMPLATE_DIR" "pre_deploy" "$CTID" "$USERNAME"

  # --------------------------------------------------------------------------
  # Phase 3: Create container
  # --------------------------------------------------------------------------
  log_step "Phase 3: Creating container $CTID ($HOSTNAME_CT)"
  state_set_phase "create"

  local ROOT_PASS
  ROOT_PASS=$(openssl rand -base64 16)

  ct_create "$CTID" "$OSTEMPLATE" \
    "hostname=${HOSTNAME_CT}" \
    "memory=${MEMORY}" \
    "swap=${SWAP}" \
    "cores=${CORES}" \
    "storage=${STORAGE}" \
    "disk=${DISK}" \
    "bridge=${BRIDGE}" \
    "ip=${IP}" \
    "gateway=${GATEWAY}" \
    "unprivileged=${UNPRIVILEGED_FLAG}" \
    "features=${FEATURES}" \
    "password=${ROOT_PASS}" \
    "tags=${TAGS}" \
    "nameserver=${NAMESERVER}" \
    "searchdomain=${SEARCHDOMAIN}"

  state_set "ROOT_PASSWORD" "$ROOT_PASS"
  log_success "Container $CTID created."

  # --------------------------------------------------------------------------
  # Phase 4: Start container
  # --------------------------------------------------------------------------
  log_step "Phase 4: Starting container $CTID"
  state_set_phase "start"
  ct_start "$CTID"
  ct_wait_running "$CTID" 30
  log_info "Waiting 3 seconds for container networking to stabilise..."
  sleep 3

  # --------------------------------------------------------------------------
  # Phase 5: Install apt packages
  # --------------------------------------------------------------------------
  log_step "Phase 5: Installing apt packages"
  state_set_phase "packages"

  local apt_pkgs
  apt_pkgs=$(cfg_get_packages "apt" | tr '\n' ' ' | xargs)
  if [[ -n "$apt_pkgs" ]]; then
    log_info "apt packages: $apt_pkgs"
    ct_install_packages "$CTID" "$apt_pkgs"
  else
    log_info "No apt packages configured, skipping."
  fi

  # Set up locale
  log_info "Configuring locale (en_US.UTF-8)..."
  ct_exec "$CTID" "locale-gen en_US.UTF-8 && update-locale LANG=en_US.UTF-8" || \
    log_warn "Locale setup failed (non-fatal)"

  # --------------------------------------------------------------------------
  # Phase 6: Push template files
  # --------------------------------------------------------------------------
  log_step "Phase 6: Pushing template files"
  state_set_phase "files"
  push_template_files "$TEMPLATE_DIR" "$CTID" "$USERNAME"

  # --------------------------------------------------------------------------
  # Phase 7: Run numbered scripts
  # --------------------------------------------------------------------------
  log_step "Phase 7: Running deployment scripts"
  state_set_phase "scripts"

  local scripts_dir="${TEMPLATE_DIR}/scripts"
  if [[ -d "$scripts_dir" ]]; then
    local script_list
    script_list=$(find "$scripts_dir" -name '[0-9][0-9]_*.sh' | sort)

    while IFS= read -r script_path; do
      [[ -z "$script_path" ]] && continue
      local script_name
      script_name=$(basename "$script_path")

      # Resume: skip already-done scripts
      if [[ "$RESUME" == true ]] && state_is_done "$script_name"; then
        log_info "Skipping (already done): $script_name"
        continue
      fi

      log_step "Running script: $script_name"

      # Build environment exports for the script
      local env_exports
      env_exports="export USERNAME='${USERNAME}'"
      env_exports+=" USER_SHELL='${USER_SHELL}'"
      env_exports+=" CTID='${CTID}'"
      env_exports+=" HOSTNAME_CT='${HOSTNAME_CT}'"
      env_exports+=" DEBIAN_FRONTEND=noninteractive"

      # Append template env vars
      local template_env
      template_env=$(cfg_get_env 2>/dev/null || true)
      if [[ -n "$template_env" ]]; then
        while IFS= read -r env_line; do
          [[ -z "$env_line" ]] && continue
          env_exports+=" ${env_line}"
        done <<< "$template_env"
      fi

      # Push the actual script
      local remote_script="/tmp/deploy-script-${script_name}"
      pct push "$CTID" "$script_path" "$remote_script" --perms 0755

      # Create a wrapper that exports env vars then sources the script
      local wrapper_content
      wrapper_content="#!/usr/bin/env bash
set -euo pipefail
${env_exports}
bash ${remote_script}
"
      local wrapper_tmp
      wrapper_tmp=$(mktemp)
      echo "$wrapper_content" > "$wrapper_tmp"
      local remote_wrapper="/tmp/deploy-wrapper-${script_name}"
      pct push "$CTID" "$wrapper_tmp" "$remote_wrapper" --perms 0755
      rm -f "$wrapper_tmp"

      # Execute the wrapper as root
      if ct_exec "$CTID" "bash ${remote_wrapper}"; then
        state_mark_done "$script_name"
        log_success "Script completed: $script_name"
      else
        state_set "FAILED_SCRIPT" "$script_name"
        state_set "STATUS" "failed"
        log_error "Script failed: $script_name"
        # Clean up in container
        ct_exec "$CTID" "rm -f ${remote_script} ${remote_wrapper}" 2>/dev/null || true
        exit 1
      fi

      # Clean up in container
      ct_exec "$CTID" "rm -f ${remote_script} ${remote_wrapper}" 2>/dev/null || true

    done <<< "$script_list"
  else
    log_info "No scripts/ directory found, skipping."
  fi

  # --------------------------------------------------------------------------
  # Phase 8: User-level packages (pip, npm, cargo, go)
  # Note: runs after scripts because scripts install the package managers
  # --------------------------------------------------------------------------
  log_step "Phase 8: Installing user-level packages"
  state_set_phase "user_packages"

  local pip_pkgs
  pip_pkgs=$(cfg_get_packages "pip" 2>/dev/null || true)
  if [[ -n "$pip_pkgs" ]]; then
    while IFS= read -r pkg; do
      [[ -z "$pkg" ]] && continue
      log_info "pip: installing $pkg via pipx"
      ct_exec_user "$CTID" "$USERNAME" "pipx install $pkg" || \
        log_warn "pipx install $pkg failed (non-fatal)"
    done <<< "$pip_pkgs"
  fi

  local npm_pkgs
  npm_pkgs=$(cfg_get_packages "npm" 2>/dev/null || true)
  if [[ -n "$npm_pkgs" ]]; then
    while IFS= read -r pkg; do
      [[ -z "$pkg" ]] && continue
      log_info "npm: installing $pkg globally"
      ct_exec_user "$CTID" "$USERNAME" "npm install -g $pkg" || \
        log_warn "npm install -g $pkg failed (non-fatal)"
    done <<< "$npm_pkgs"
  fi

  local cargo_pkgs
  cargo_pkgs=$(cfg_get_packages "cargo" 2>/dev/null || true)
  if [[ -n "$cargo_pkgs" ]]; then
    while IFS= read -r pkg; do
      [[ -z "$pkg" ]] && continue
      log_info "cargo: installing $pkg"
      ct_exec_user "$CTID" "$USERNAME" "cargo install $pkg" || \
        log_warn "cargo install $pkg failed (non-fatal)"
    done <<< "$cargo_pkgs"
  fi

  local go_pkgs
  go_pkgs=$(cfg_get_packages "go" 2>/dev/null || true)
  if [[ -n "$go_pkgs" ]]; then
    while IFS= read -r pkg; do
      [[ -z "$pkg" ]] && continue
      log_info "go: installing $pkg"
      ct_exec_user "$CTID" "$USERNAME" "go install $pkg" || \
        log_warn "go install $pkg failed (non-fatal)"
    done <<< "$go_pkgs"
  fi

  # --------------------------------------------------------------------------
  # Phase 9: Configure environment variables
  # --------------------------------------------------------------------------
  log_step "Phase 9: Configuring environment"
  state_set_phase "env"

  local user_profile="/home/${USERNAME}/.profile"

  # PATH additions from .env.PATH_APPEND
  local path_additions
  path_additions=$(cfg_get_array '.env.PATH_APPEND' 2>/dev/null || true)
  if [[ -n "$path_additions" ]]; then
    log_info "Appending PATH entries to $user_profile..."
    while IFS= read -r path_entry; do
      [[ -z "$path_entry" ]] && continue
      ct_exec "$CTID" "echo 'export PATH=\"${path_entry}:\$PATH\"' >> ${user_profile}"
    done <<< "$path_additions"
  fi

  # All other env vars (excluding PATH_APPEND)
  local env_vars
  env_vars=$(cfg_get_env 2>/dev/null | grep -v "^PATH_APPEND=" || true)
  if [[ -n "$env_vars" ]]; then
    log_info "Writing env vars to $user_profile..."
    while IFS= read -r env_line; do
      [[ -z "$env_line" ]] && continue
      ct_exec "$CTID" "echo 'export ${env_line}' >> ${user_profile}"
    done <<< "$env_vars"
  fi

  # Ensure .profile is sourced from .bashrc
  ct_exec "$CTID" "
    grep -q 'source.*\\.profile\\|\\. \\~/.profile' /home/${USERNAME}/.bashrc 2>/dev/null || \
    echo '[ -f ~/.profile ] && . ~/.profile' >> /home/${USERNAME}/.bashrc
  " || true

  # Ensure .profile is sourced from .zshrc if zsh is present
  ct_exec "$CTID" "
    if [ -f /home/${USERNAME}/.zshrc ]; then
      grep -q '\\.profile' /home/${USERNAME}/.zshrc 2>/dev/null || \
      echo '[ -f ~/.profile ] && . ~/.profile' >> /home/${USERNAME}/.zshrc
    fi
  " || true

  # --------------------------------------------------------------------------
  # Phase 10: Post-deploy hook (runs inside container)
  # --------------------------------------------------------------------------
  log_step "Phase 10: Post-deploy hook (container)"
  state_set_phase "post_deploy"
  run_hook "$TEMPLATE_DIR" "post_deploy" "$CTID" "$USERNAME"

  # --------------------------------------------------------------------------
  # Phase 11: Summary
  # --------------------------------------------------------------------------
  log_step "Phase 11: Deployment complete!"
  state_set "STATUS" "complete"
  state_set "DEPLOY_COMPLETED" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  # Calculate elapsed time
  local started
  started=$(state_get "DEPLOY_STARTED")
  local elapsed="unknown"
  if [[ -n "$started" ]]; then
    local start_epoch end_epoch
    start_epoch=$(date -d "$started" +%s 2>/dev/null || echo 0)
    end_epoch=$(date +%s)
    local diff=$(( end_epoch - start_epoch ))
    elapsed="${diff}s"
    if (( diff >= 60 )); then
      elapsed="$(( diff / 60 ))m $(( diff % 60 ))s"
    fi
  fi

  local root_pass
  root_pass=$(state_get "ROOT_PASSWORD")

  echo ""
  echo "============================================================"
  echo "  DEPLOYMENT COMPLETE"
  echo "============================================================"
  echo "  Template:     $TEMPLATE_NAME $TEMPLATE_VERSION"
  echo "  Description:  $TEMPLATE_DESCRIPTION"
  echo "  Container ID: $CTID"
  echo "  Hostname:     $HOSTNAME_CT"
  echo "  IP:           $IP"
  echo "  Root pass:    $root_pass"
  echo "  Username:     $USERNAME"
  echo "  Duration:     $elapsed"
  echo ""
  echo "  Connect with: pct enter $CTID"
  echo "============================================================"
  echo ""

  # Clean up state file on success
  state_cleanup
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
parse_args "$@"
validate
deploy
