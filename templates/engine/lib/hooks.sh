#!/usr/bin/env bash
# hooks.sh — Hook execution for LXC container template deployment
# Designed to be sourced (not executed directly).
# Requires logging.sh and container.sh to be sourced first.
#
# Hook modes:
#   pre_deploy  -> runs ON THE PROXMOX HOST before the container is created
#   post_deploy -> runs INSIDE THE CONTAINER after all scripts/files/packages
#
# All hooks receive env vars: CTID, HOSTNAME, USERNAME, TEMPLATE_DIR

# run_hook_host "$template_dir" "$hook_name" "$ctid" "$username"
# Runs a hook script directly on the Proxmox host.
# Hook file is looked up as $template_dir/hooks/<hook-name-with-hyphens>.sh
# (underscores in hook_name are converted to hyphens in filename).
run_hook_host() {
    local template_dir="$1"
    local hook_name="$2"
    local ctid="$3"
    local username="$4"

    # Convert underscores to hyphens for filename convention
    local hook_file="${template_dir}/hooks/${hook_name//_/-}.sh"

    if [[ ! -f "$hook_file" ]]; then
        log_debug "No hook file found: $hook_file (skipping)"
        return 0
    fi

    log_info "Running host hook: $hook_name ($hook_file)"

    # Export environment for the hook script
    export CTID="$ctid"
    export HOSTNAME_CT="${HOSTNAME_CT:-}"
    export USERNAME="$username"
    export TEMPLATE_DIR="$template_dir"

    if bash "$hook_file"; then
        log_debug "Host hook $hook_name completed successfully"
        return 0
    else
        log_error "Host hook $hook_name failed (exit code $?)"
        return 1
    fi
}

# run_hook_container "$template_dir" "$hook_name" "$ctid" "$username"
# Runs a hook script INSIDE the container.
# Pushes the script to /tmp/hook-<hook_name>.sh, executes it via ct_exec, then removes it.
run_hook_container() {
    local template_dir="$1"
    local hook_name="$2"
    local ctid="$3"
    local username="$4"

    # Convert underscores to hyphens for filename convention
    local hook_file="${template_dir}/hooks/${hook_name//_/-}.sh"

    if [[ ! -f "$hook_file" ]]; then
        log_debug "No hook file found: $hook_file (skipping)"
        return 0
    fi

    log_info "Running container hook: $hook_name ($hook_file)"

    local remote_hook="/tmp/hook-${hook_name}.sh"

    # Set environment variables to inject into container
    local env_prefix="CTID=${ctid} USERNAME=${username} TEMPLATE_DIR=${template_dir}"
    [[ -n "${HOSTNAME_CT:-}" ]] && env_prefix="${env_prefix} HOSTNAME_CT=${HOSTNAME_CT}"

    # Push the hook script to the container
    pct push "$ctid" "$hook_file" "$remote_hook" --perms 0755

    # Execute the hook inside the container with env vars
    if ct_exec "$ctid" "${env_prefix} bash ${remote_hook}"; then
        log_debug "Container hook $hook_name completed successfully"
        ct_exec "$ctid" "rm -f ${remote_hook}" || true
        return 0
    else
        local exit_code=$?
        log_error "Container hook $hook_name failed (exit code ${exit_code})"
        ct_exec "$ctid" "rm -f ${remote_hook}" || true
        return 1
    fi
}

# run_hook "$template_dir" "$hook_name" "$ctid" "$username"
# Convenience wrapper that routes hooks to the correct executor:
#   pre_deploy  -> run_hook_host  (runs on host, before container creation)
#   post_deploy -> run_hook_container (runs inside container, after provisioning)
run_hook() {
    local template_dir="$1"
    local hook_name="$2"
    local ctid="$3"
    local username="$4"

    case "$hook_name" in
        pre_deploy)
            run_hook_host "$template_dir" "$hook_name" "$ctid" "$username"
            ;;
        post_deploy)
            run_hook_container "$template_dir" "$hook_name" "$ctid" "$username"
            ;;
        *)
            log_warn "run_hook: unknown hook name '$hook_name', running as container hook"
            run_hook_container "$template_dir" "$hook_name" "$ctid" "$username"
            ;;
    esac
}
