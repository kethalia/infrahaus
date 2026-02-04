#!/usr/bin/env bats
# test-config-sync.bats — Unit tests for config-sync.sh functions

load '../bats-helpers'

setup() {
    mkdir -p "$LOG_DIR" /run/config-manager /etc/config-manager
    touch "$LOG_FILE"

    # Source logging functions
    log_info()  { echo "[INFO] $*"; }
    log_warn()  { echo "[WARN] $*"; }
    log_error() { echo "[ERROR] $*"; }
    export -f log_info log_warn log_error
}

teardown() {
    rm -f "$LOCK_FILE"
    rm -f "$LOG_FILE"
    rm -f "$CONFIG_FILE"
}

# Note: These tests extract specific functions from config-sync.sh
# This is a simplified approach - full testing would require refactoring config-sync.sh

@test "config-sync: lock file variables are defined" {
    # Just verify the script defines the expected variables
    run bash -c "
        source <(grep -E '^readonly (LOCK_FILE|CONFIG_FILE|LOG_FILE|REPO_DIR)=' '${CM_SCRIPTS}/config-sync.sh')
        echo \"LOCK_FILE=\$LOCK_FILE\"
        echo \"CONFIG_FILE=\$CONFIG_FILE\"
    "
    assert_success
    assert_output --partial "LOCK_FILE=/run/config-manager"
    assert_output --partial "CONFIG_FILE=/etc/config-manager"
}

@test "config-sync: version is defined" {
    run bash -c "
        source <(grep '^readonly CONFIG_SYNC_VERSION=' '${CM_SCRIPTS}/config-sync.sh')
        echo \"\$CONFIG_SYNC_VERSION\"
    "
    assert_success
    assert_output --partial "0."
}

@test "load_config: fails when config file missing" {
    CONFIG_FILE="/etc/config-manager/nonexistent.env"
    LOG_FILE="/var/log/config-manager/sync.log"
    mkdir -p "$LOG_DIR"
    touch "$LOG_FILE"

    run bash -c "
        export CONFIG_FILE='$CONFIG_FILE'
        export LOG_FILE='$LOG_FILE'
        log_info()  { echo \"[INFO] \$*\"; }
        log_warn()  { echo \"[WARN] \$*\"; }
        log_error() { echo \"[ERROR] \$*\"; }
        export -f log_info log_warn log_error
        
        source <(sed -n '/^load_config()/,/^}/p' '${CM_SCRIPTS}/config-sync.sh')
        load_config
    "
    assert_failure
    assert_output --partial "not found"
}

@test "load_config: succeeds with valid config" {
    CONFIG_FILE="/etc/config-manager/config.env"
    LOG_FILE="/var/log/config-manager/sync.log"
    mkdir -p "$LOG_DIR" /etc/config-manager
    touch "$LOG_FILE"

    cat > "$CONFIG_FILE" <<'EOF'
CONFIG_REPO_URL="https://github.com/test/repo.git"
CONFIG_BRANCH="main"
CONFIG_PATH="test/path"
EOF
    chmod 600 "$CONFIG_FILE"

    run bash -c "
        export CONFIG_FILE='$CONFIG_FILE'
        export LOG_FILE='$LOG_FILE'
        log_info()  { echo \"[INFO] \$*\"; }
        log_warn()  { echo \"[WARN] \$*\"; }
        log_error() { echo \"[ERROR] \$*\"; }
        export -f log_info log_warn log_error
        
        source <(sed -n '/^load_config()/,/^}/p' '${CM_SCRIPTS}/config-sync.sh')
        load_config
        echo \"URL=\$CONFIG_REPO_URL\"
    "
    assert_success
    assert_output --partial "URL=https://github.com/test/repo.git"
}

@test "load_config: warns about insecure permissions" {
    CONFIG_FILE="/etc/config-manager/config.env"
    LOG_FILE="/var/log/config-manager/sync.log"
    mkdir -p "$LOG_DIR" /etc/config-manager
    touch "$LOG_FILE"

    cat > "$CONFIG_FILE" <<'EOF'
CONFIG_REPO_URL="https://github.com/test/repo.git"
EOF
    chmod 644 "$CONFIG_FILE"

    run bash -c "
        export CONFIG_FILE='$CONFIG_FILE'
        export LOG_FILE='$LOG_FILE'
        log_info()  { echo \"[INFO] \$*\"; }
        log_warn()  { echo \"[WARN] \$*\"; }
        log_error() { echo \"[ERROR] \$*\"; }
        export -f log_info log_warn log_error
        
        source <(sed -n '/^load_config()/,/^}/p' '${CM_SCRIPTS}/config-sync.sh')
        load_config
    "
    assert_success
    assert_output --partial "permissions are 644"
}

@test "load_config: rejects invalid URL format" {
    CONFIG_FILE="/etc/config-manager/config.env"
    LOG_FILE="/var/log/config-manager/sync.log"
    mkdir -p "$LOG_DIR" /etc/config-manager
    touch "$LOG_FILE"

    cat > "$CONFIG_FILE" <<'EOF'
CONFIG_REPO_URL="not-a-valid-url"
EOF
    chmod 600 "$CONFIG_FILE"

    run bash -c "
        export CONFIG_FILE='$CONFIG_FILE'
        export LOG_FILE='$LOG_FILE'
        log_info()  { echo \"[INFO] \$*\"; }
        log_warn()  { echo \"[WARN] \$*\"; }
        log_error() { echo \"[ERROR] \$*\"; }
        export -f log_info log_warn log_error
        
        source <(sed -n '/^load_config()/,/^}/p' '${CM_SCRIPTS}/config-sync.sh')
        load_config
    "
    assert_failure
    assert_output --partial "must be an HTTP"
}
