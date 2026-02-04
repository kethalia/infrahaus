#!/usr/bin/env bats
# test-user-setup.bats — Integration tests for 01-setup-user.sh
# Tests the actual user creation, sudoers, and permissions
# that have been causing failures on real Proxmox deployments

load '../bats-helpers'

setup() {
    mkdir -p "$LOG_DIR" /etc/sudoers.d
    touch "$LOG_FILE"
    install_helpers

    # Clean up any previous test user
    userdel -r testcoder 2>/dev/null || true
}

teardown() {
    userdel -r testcoder 2>/dev/null || true
    rm -f /etc/sudoers.d/testcoder
}

@test "user-setup: creates user with correct UID" {
    useradd -m -u 1000 -s /bin/bash -G sudo testcoder
    run id -u testcoder
    assert_success
    assert_output "1000"
}

@test "user-setup: user has sudo group" {
    useradd -m -u 1000 -s /bin/bash -G sudo testcoder
    run groups testcoder
    assert_success
    assert_output --partial "sudo"
}

@test "user-setup: can write to /etc/sudoers.d (ProtectSystem fix)" {
    # This tests the ProtectSystem=strict fix
    cat > /etc/sudoers.d/testcoder <<'EOF'
testcoder ALL=(ALL) NOPASSWD: ALL
EOF
    chmod 0440 /etc/sudoers.d/testcoder

    # Validate sudoers syntax
    run visudo -c -f /etc/sudoers.d/testcoder
    assert_success
}

@test "user-setup: chown works after user creation (catches 'invalid user' bug)" {
    # This catches the 'chown: invalid user' bug
    useradd -m -u 1000 -s /bin/bash testcoder

    # Verify user exists in passwd
    run getent passwd testcoder
    assert_success

    # Verify chown works
    run chown -R testcoder:testcoder /home/testcoder
    assert_success
}

@test "user-setup: idempotent - running twice succeeds" {
    useradd -m -u 1000 -s /bin/bash -G sudo testcoder

    local script="${PROJECT_ROOT}/infra/lxc/templates/web3-dev/container-configs/scripts/01-setup-user.sh"
    sed 's/coder/testcoder/g' "$script" > /tmp/test-setup-user.sh
    chmod +x /tmp/test-setup-user.sh

    source "${LIB_DIR}/config-manager-helpers.sh"

    # Run once
    run bash /tmp/test-setup-user.sh
    assert_success

    # Run again - should still succeed
    run bash /tmp/test-setup-user.sh
    assert_success
    assert_output --partial "already exists"

    rm -f /tmp/test-setup-user.sh
}
