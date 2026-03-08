#!/usr/bin/env bash
# files.sh — Template file push with USER placeholder replacement
# Designed to be sourced (not executed directly).
# Requires logging.sh and container.sh to be sourced first.

# push_template_files "$template_dir" "$ctid" "$username"
# Iterates over all files in $template_dir/files/, replaces USER in the path
# with $username, creates parent directories in the container, and pushes each
# file with correct ownership.
#
# Ownership rules:
#   - Files under /home/$username/ -> user ownership (1000:1000 default)
#   - Files under /etc/, /usr/, /root/ -> root ownership (0:0)
push_template_files() {
    local template_dir="$1"
    local ctid="$2"
    local username="$3"
    local files_dir="${template_dir}/files"

    if [[ ! -d "$files_dir" ]]; then
        log_debug "No files/ directory found in $template_dir, skipping file push"
        return 0
    fi

    find "$files_dir" -type f | sort | while read -r local_file; do
        # Strip the template files/ prefix to get the relative container path
        local rel_path="${local_file#"${files_dir}/"}"
        # Add leading slash to make it absolute
        local container_path="/${rel_path}"
        # Replace USER placeholder with actual username
        container_path="${container_path//USER/$username}"

        log_info "Pushing: $local_file -> $container_path"

        # Determine UID/GID based on path
        local uid=0
        local gid=0
        if [[ "$container_path" == /home/$username/* ]]; then
            uid=1000
            gid=1000
        fi

        push_single_file "$ctid" "$local_file" "$container_path" "$uid" "$gid"
    done
}

# push_single_file "$ctid" "$local_path" "$container_path" "$uid" "$gid"
# Pushes a single file with USER placeholder replacement in file contents,
# then sets ownership on the container side.
push_single_file() {
    local ctid="$1"
    local local_path="$2"
    local container_path="$3"
    local uid="${4:-0}"
    local gid="${5:-0}"

    # Create a temp copy with USER placeholder replaced in contents
    local tmp_file
    tmp_file=$(mktemp)
    sed "s|USER|${USERNAME:-}|g" "$local_path" > "$tmp_file"

    # Ensure parent directory exists in container
    local parent_dir
    parent_dir=$(dirname "$container_path")
    pct exec "$ctid" -- mkdir -p "$parent_dir" || true

    # Push the file with correct permissions and ownership
    ct_push "$ctid" "$tmp_file" "$container_path" \
        --user "$uid" --group "$gid"

    # Clean up temp file
    rm -f "$tmp_file"
}
