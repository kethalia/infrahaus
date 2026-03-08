#\!/usr/bin/env bash
# config.sh — yq-based YAML config reader for template.yaml
# Designed to be sourced (not executed directly).
# Requires TEMPLATE_DIR and TEMPLATE_YAML to be set before sourcing.
#
# TEMPLATE_YAML should be set to the full path of the template.yaml file.
# If not set, defaults to $TEMPLATE_DIR/template.yaml

: "${TEMPLATE_DIR:?config.sh requires TEMPLATE_DIR to be set}"
TEMPLATE_YAML="${TEMPLATE_YAML:-$TEMPLATE_DIR/template.yaml}"

# cfg_get "path"
# Reads a single scalar value from template.yaml using yq.
# Returns empty string for null/missing values.
# Example: cfg_get '.container.hostname'
cfg_get() {
    local path="$1"
    local val
    val=$(yq "$path" "$TEMPLATE_YAML" 2>/dev/null) || return 1
    # Convert yq null to empty string
    [[ "$val" == "null" ]] && echo "" || echo "$val"
}

# cfg_get_default "path" "default"
# Reads a value with a fallback default if null/empty.
# Example: cfg_get_default '.container.storage' 'local-lvm'
cfg_get_default() {
    local path="$1"
    local default="$2"
    local val
    val=$(cfg_get "$path")
    [[ -z "$val" ]] && echo "$default" || echo "$val"
}

# cfg_get_array "path"
# Reads array values from template.yaml, one item per line.
# Example: cfg_get_array '.container.features'
cfg_get_array() {
    local path="$1"
    yq -r "${path}[]" "$TEMPLATE_YAML" 2>/dev/null | grep -v "^null$" || true
}

# cfg_get_packages "manager"
# Reads package list for a specific package manager, one package per line.
# Example: cfg_get_packages 'apt' reads .packages.apt[]
cfg_get_packages() {
    local manager="$1"
    yq -r ".packages.${manager}[]" "$TEMPLATE_YAML" 2>/dev/null | grep -v "^null$" || true
}

# cfg_get_env
# Reads the .env block as KEY=VALUE lines.
# Replaces USER placeholder with the actual username from .user.name
cfg_get_env() {
    local username
    username=$(cfg_get '.user.name')

    yq -r '.env | to_entries | .[] | .key + "=" + (.value | tostring)' \
        "$TEMPLATE_YAML" 2>/dev/null \
        | grep -v "^null=" \
        | sed "s|USER|${username}|g" \
        || true
}
