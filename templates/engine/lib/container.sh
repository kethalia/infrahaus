#\!/usr/bin/env bash
# container.sh — pct wrapper functions for LXC container lifecycle management
# Designed to be sourced (not executed directly).
# Requires logging.sh to be sourced first (uses log_info, log_error, log_debug).

# ct_exists "$ctid"
# Returns 0 if a container with this CTID exists, 1 otherwise.
ct_exists() {
    local ctid="$1"
    pct status "$ctid" &>/dev/null
}

# ct_is_running "$ctid"
# Returns 0 if the container is in running state, 1 otherwise.
ct_is_running() {
    local ctid="$1"
    pct status "$ctid" 2>/dev/null | grep -q "status: running"
}

# ct_create "$ctid" "$ostemplate" [key=value ...]
# Wraps pct create with common template options.
# Accepts key=value pairs for all configuration options.
# Supported keys: hostname, memory, swap, cores, storage, disk, bridge, ip,
#   gateway, unprivileged, features, ostype, password, onboot, tags,
#   nameserver, searchdomain, ssh_keys, start
ct_create() {
    local ctid="$1"
    local ostemplate="$2"
    shift 2

    # Defaults
    local hostname="ct${ctid}"
    local memory=512
    local swap=512
    local cores=1
    local storage="local-lvm"
    local disk=8
    local bridge="vmbr0"
    local ip="dhcp"
    local gateway=""
    local unprivileged=1
    local features=""
    local ostype="ubuntu"
    local password=""
    local onboot=0
    local tags=""
    local nameserver=""
    local searchdomain=""
    local ssh_keys=""
    local start=0

    # Parse key=value arguments
    for arg in "$@"; do
        local key="${arg%%=*}"
        local val="${arg#*=}"
        case "$key" in
            hostname)     hostname="$val" ;;
            memory)       memory="$val" ;;
            swap)         swap="$val" ;;
            cores)        cores="$val" ;;
            storage)      storage="$val" ;;
            disk)         disk="$val" ;;
            bridge)       bridge="$val" ;;
            ip)           ip="$val" ;;
            gateway)      gateway="$val" ;;
            unprivileged) unprivileged="$val" ;;
            features)     features="$val" ;;
            ostype)       ostype="$val" ;;
            password)     password="$val" ;;
            onboot)       onboot="$val" ;;
            tags)         tags="$val" ;;
            nameserver)   nameserver="$val" ;;
            searchdomain) searchdomain="$val" ;;
            ssh_keys)     ssh_keys="$val" ;;
            start)        start="$val" ;;
        esac
    done

    # Build net0 config
    local net0="name=eth0,bridge=${bridge},ip=${ip}"
    [[ -n "$gateway" ]] && net0="${net0},gw=${gateway}"

    # Build pct create command array
    local cmd=(
        pct create "$ctid" "$ostemplate"
        --hostname "$hostname"
        --memory "$memory"
        --swap "$swap"
        --cores "$cores"
        --rootfs "${storage}:${disk}"
        --net0 "$net0"
        --unprivileged "$unprivileged"
        --ostype "$ostype"
        --onboot "$onboot"
        --start "$start"
    )

    [[ -n "$features" ]]     && cmd+=(--features "$features")
    [[ -n "$password" ]]     && cmd+=(--password "$password")
    [[ -n "$tags" ]]         && cmd+=(--tags "$tags")
    [[ -n "$nameserver" ]]   && cmd+=(--nameserver "$nameserver")
    [[ -n "$searchdomain" ]] && cmd+=(--searchdomain "$searchdomain")
    [[ -n "$ssh_keys" ]]     && cmd+=(--ssh-public-keys "$ssh_keys")

    log_debug "Running: ${cmd[*]}"
    "${cmd[@]}"
}

# ct_start "$ctid"
# Starts the container and waits up to 30 seconds for running state.
ct_start() {
    local ctid="$1"
    log_info "Starting container $ctid..."
    pct start "$ctid"
    ct_wait_running "$ctid" 30
}

# ct_wait_running "$ctid" "$timeout"
# Polls pct status every 2 seconds until running or timeout (seconds).
# Returns 0 when running, 1 on timeout.
ct_wait_running() {
    local ctid="$1"
    local timeout="${2:-30}"
    local elapsed=0

    while \! ct_is_running "$ctid"; do
        if [[ $elapsed -ge $timeout ]]; then
            log_error "Container $ctid did not reach running state within ${timeout}s"
            return 1
        fi
        sleep 2
        (( elapsed += 2 ))
    done

    log_debug "Container $ctid is running (waited ${elapsed}s)"
    return 0
}

# ct_exec "$ctid" "$cmd"
# Runs a command as root inside the container.
# Returns the exit code of the command.
ct_exec() {
    local ctid="$1"
    local cmd="$2"
    log_debug "ct_exec[$ctid]: $cmd"
    pct exec "$ctid" -- bash -c "$cmd"
}

# ct_exec_user "$ctid" "$username" "$cmd"
# Runs a command as a specific user inside the container via su - (login shell).
# Critical for tools installed to user home dirs (foundry, cargo, etc).
ct_exec_user() {
    local ctid="$1"
    local username="$2"
    local cmd="$3"
    log_debug "ct_exec_user[$ctid as $username]: $cmd"
    pct exec "$ctid" -- su - "$username" -c "$cmd"
}

# ct_push "$ctid" "$local" "$remote" [--perms PERMS] [--user UID] [--group GID]
# Wraps pct push with optional permissions and ownership flags.
ct_push() {
    local ctid="$1"
    local local_path="$2"
    local remote_path="$3"
    shift 3

    local cmd=(pct push "$ctid" "$local_path" "$remote_path")

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --perms)  cmd+=(--perms "$2");  shift 2 ;;
            --user)   cmd+=(--user "$2");   shift 2 ;;
            --group)  cmd+=(--group "$2");  shift 2 ;;
            *)        log_error "ct_push: unknown option $1"; return 1 ;;
        esac
    done

    log_debug "Running: ${cmd[*]}"
    "${cmd[@]}"
}

# ct_stop "$ctid"
# Graceful shutdown with 30s timeout, falls back to pct stop on failure.
ct_stop() {
    local ctid="$1"
    log_info "Stopping container $ctid..."
    if \! pct shutdown "$ctid" --timeout 30 2>/dev/null; then
        log_warn "Graceful shutdown timed out, forcing stop of container $ctid"
        pct stop "$ctid"
    fi
}

# ct_destroy "$ctid"
# Stops the container if running, then destroys it with --purge.
ct_destroy() {
    local ctid="$1"
    if ct_is_running "$ctid"; then
        ct_stop "$ctid"
    fi
    log_info "Destroying container $ctid..."
    pct destroy "$ctid" --purge
}

# ct_install_packages "$ctid" "$packages_string"
# Runs apt-get update and installs the given space-separated package list inside the container.
ct_install_packages() {
    local ctid="$1"
    local packages="$2"
    log_info "Installing packages in container $ctid: $packages"
    ct_exec "$ctid" "DEBIAN_FRONTEND=noninteractive apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y $packages"
}

# ct_next_id
# Returns the next available VMID from the Proxmox cluster.
ct_next_id() {
    pvesh get /cluster/nextid
}
