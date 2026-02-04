#!/usr/bin/env bats
# test-shellcheck.bats — Run shellcheck on all shell scripts

load '../bats-helpers'

@test "shellcheck: config-sync.sh passes" {
    run shellcheck -x -S warning "${CM_SCRIPTS}/config-sync.sh"
    assert_success
}

@test "shellcheck: config-manager-helpers.sh passes" {
    run shellcheck -x -S warning "${CM_SCRIPTS}/config-manager-helpers.sh"
    assert_success
}

@test "shellcheck: execute-scripts.sh passes" {
    # SC1090: Dynamic sourcing is expected (sources user scripts)
    run shellcheck -x -S warning --exclude=SC1090 "${CM_SCRIPTS}/execute-scripts.sh"
    assert_success
}

@test "shellcheck: process-files.sh passes" {
    run shellcheck -x -S warning "${CM_SCRIPTS}/process-files.sh"
    assert_success
}

@test "shellcheck: all package handlers pass" {
    local handler_dir="${CM_SCRIPTS}/package-handlers"
    local failures=0

    for handler in "${handler_dir}"/*.sh; do
        [ -f "$handler" ] || continue
        if ! shellcheck -x -S warning "$handler"; then
            echo "FAILED: $(basename "$handler")"
            ((failures++))
        fi
    done

    [ "$failures" -eq 0 ]
}

@test "shellcheck: container-config scripts pass" {
    local scripts_dir="${PROJECT_ROOT}/infra/lxc/templates/web3-dev/container-configs/scripts"
    local failures=0

    for script in "${scripts_dir}"/*.sh; do
        [ -f "$script" ] || continue
        # These scripts use log_info/is_installed from helpers (external sourcing)
        if ! shellcheck -x -S warning --exclude=SC2154 "$script"; then
            echo "FAILED: $(basename "$script")"
            ((failures++))
        fi
    done

    [ "$failures" -eq 0 ]
}
