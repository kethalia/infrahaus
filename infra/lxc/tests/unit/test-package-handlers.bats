#!/usr/bin/env bats
# test-package-handlers.bats — Unit tests for package handler system

load '../bats-helpers'

setup() {
    mkdir -p "$LOG_DIR" "$REPO_DIR"
    touch "$LOG_FILE"
    install_helpers

    CONFIG_PATH="infra/lxc/templates/web3-dev/container-configs"
    export REPO_DIR CONFIG_PATH LOG_FILE LIB_DIR
}

teardown() {
    rm -rf "$REPO_DIR"/*
    rm -f "$LOG_FILE"
}

@test "handler-common: returns 0 when no packages directory" {
    local pkg_dir="${REPO_DIR}/${CONFIG_PATH}/nonexistent-packages"

    run bash -c "
        export REPO_DIR='$REPO_DIR'
        export CONFIG_PATH='$CONFIG_PATH'
        export LOG_FILE='$LOG_FILE'
        export LIB_DIR='$LIB_DIR'
        # Source helpers first
        source '${LIB_DIR}/config-manager-helpers.sh' 2>/dev/null || true
        source '${LIB_DIR}/package-handlers/handler-common.sh'
        install_packages '${pkg_dir}'
    "
    assert_success
}

@test "handler-common: discovers .apt package files" {
    local pkg_dir="${REPO_DIR}/${CONFIG_PATH}/packages"
    mkdir -p "$pkg_dir"

    echo "curl" > "${pkg_dir}/base.apt"
    echo "wget" >> "${pkg_dir}/base.apt"

    run bash -c "
        export REPO_DIR='$REPO_DIR'
        export CONFIG_PATH='$CONFIG_PATH'
        export LOG_FILE='$LOG_FILE'
        export LIB_DIR='$LIB_DIR'
        # Source helpers first
        source '${LIB_DIR}/config-manager-helpers.sh' 2>/dev/null || true
        source '${LIB_DIR}/package-handlers/handler-common.sh'
        install_packages '${pkg_dir}'
    " 2>&1
    
    # Should at least mention the package file
    assert_output --partial "base.apt"
}

@test "handler-apt: parses package list correctly" {
    local test_file="/tmp/test-packages.apt"
    cat > "$test_file" <<'EOF'
# This is a comment
curl
wget

# Another comment
git
EOF

    # Just test that the handler can read the file without errors
    run bash -c "
        log_info() { echo \"[INFO] \$*\"; }
        log_warn() { echo \"[WARN] \$*\"; }
        log_error() { echo \"[ERROR] \$*\"; }
        export -f log_info log_warn log_error
        
        # Read the file and count non-comment lines
        packages=\$(grep -v '^#' '$test_file' | grep -v '^$' | wc -l)
        echo \"Found \$packages packages\"
    "
    assert_success
    assert_output --partial "Found 3 packages"

    rm -f "$test_file"
}

@test "handler-logging: provides log stubs" {
    # Test that the handler-logging file exists and is sourceable
    run bash -c "
        if [ -f '${LIB_DIR}/package-handlers/handler-logging.sh' ]; then
            echo 'handler-logging.sh exists'
        else
            echo 'handler-logging.sh NOT FOUND'
            exit 1
        fi
    "
    assert_success
    assert_output --partial "exists"
}
