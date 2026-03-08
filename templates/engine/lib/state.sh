#!/usr/bin/env bash
# state.sh — Deploy state management using a .deploy-state key=value file
# Designed to be sourced (not executed directly).
#
# DEPLOY_STATE_FILE should be set by deploy.sh before sourcing this library.
# Typically: DEPLOY_STATE_FILE="$TEMPLATE_DIR/.deploy-state"

# state_init "$ctid"
# Creates the state file with initial fields if it does not already exist.
# Fields: DEPLOY_STARTED, CTID, PHASE, COMPLETED_SCRIPTS, STATUS
state_init() {
    local ctid="$1"
    if [[ ! -f "$DEPLOY_STATE_FILE" ]]; then
        cat > "$DEPLOY_STATE_FILE" <<EOF
DEPLOY_STARTED=$(date -u +%Y-%m-%dT%H:%M:%SZ)
CTID=${ctid}
PHASE=create
COMPLETED_SCRIPTS=
STATUS=running
EOF
    fi
}

# state_get "key"
# Reads the value for a key from the state file.
# Returns empty string if key is not present.
state_get() {
    local key="$1"
    grep "^${key}=" "$DEPLOY_STATE_FILE" 2>/dev/null | cut -d= -f2-
}

# state_set "key" "value"
# Sets or updates a key in the state file.
# Uses sed to replace existing value; appends if key is not found.
state_set() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=" "$DEPLOY_STATE_FILE" 2>/dev/null; then
        sed -i "s|^${key}=.*|${key}=${value}|" "$DEPLOY_STATE_FILE"
    else
        echo "${key}=${value}" >> "$DEPLOY_STATE_FILE"
    fi
}

# state_mark_done "script_name"
# Appends the script name to the COMPLETED_SCRIPTS comma-separated list.
state_mark_done() {
    local script_name="$1"
    local completed
    completed=$(state_get "COMPLETED_SCRIPTS")
    state_set "COMPLETED_SCRIPTS" "${completed:+${completed},}${script_name}"
}

# state_is_done "script_name"
# Returns 0 (true) if the script appears in COMPLETED_SCRIPTS, 1 otherwise.
state_is_done() {
    local script_name="$1"
    local completed
    completed=$(state_get "COMPLETED_SCRIPTS")
    [[ ",${completed}," == *",${script_name},"* ]]
}

# state_set_phase "phase_name"
# Convenience wrapper: sets the PHASE field.
state_set_phase() {
    state_set "PHASE" "$1"
}

# state_cleanup
# Removes the state file on successful deployment completion.
state_cleanup() {
    [[ -f "$DEPLOY_STATE_FILE" ]] && rm -f "$DEPLOY_STATE_FILE"
}
