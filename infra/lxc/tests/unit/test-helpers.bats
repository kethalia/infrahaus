#!/usr/bin/env bats
# test-helpers.bats — Unit tests for config-manager-helpers.sh

load '../bats-helpers'

setup() {
    # Provide logging stubs
    log_info()  { echo "[INFO] $*"; }
    log_warn()  { echo "[WARN] $*"; }
    log_error() { echo "[ERROR] $*"; }
    export -f log_info log_warn log_error

    # Unset the guard so we can re-source
    unset _CONFIG_MANAGER_HELPERS_LOADED

    source "${CM_SCRIPTS}/config-manager-helpers.sh"
}

@test "detect_container_os: detects ubuntu from /etc/os-release" {
    detect_container_os
    assert_equal "$CONTAINER_OS" "ubuntu"
    assert_equal "$CONTAINER_OS_VERSION" "24.04"
}

@test "detect_package_manager: detects apt on Ubuntu" {
    detect_package_manager
    assert_equal "$_PKG_MGR" "apt"
}

@test "is_installed: returns 0 for bash" {
    run is_installed bash
    assert_success
}

@test "is_installed: returns 1 for nonexistent command" {
    run is_installed this_command_does_not_exist_xyz
    assert_failure
}

@test "ensure_installed: skips if command already exists" {
    run ensure_installed bash
    assert_success
    assert_output --partial "already available"
}

@test "detect_first_run: returns true when marker absent" {
    rm -f /var/log/config-manager/.first-run-complete
    detect_first_run
    assert_equal "$CONFIG_MANAGER_FIRST_RUN" "true"
}

@test "detect_first_run: returns false when marker present" {
    mkdir -p /var/log/config-manager
    touch /var/log/config-manager/.first-run-complete
    detect_first_run
    assert_equal "$CONFIG_MANAGER_FIRST_RUN" "false"
    rm -f /var/log/config-manager/.first-run-complete
}
