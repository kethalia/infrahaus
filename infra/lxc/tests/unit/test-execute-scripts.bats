#!/usr/bin/env bats
# test-execute-scripts.bats — Unit tests for execute-scripts.sh

load '../bats-helpers'

setup() {
    mkdir -p "$LOG_DIR" "$REPO_DIR"
    touch "$LOG_FILE"
    export REPO_DIR CONFIG_PATH LOG_FILE LIB_DIR

    # Install helpers
    install_helpers

    CONFIG_PATH="infra/lxc/templates/web3-dev/container-configs"
}

teardown() {
    rm -rf "$REPO_DIR"/*
    rm -f "$LOG_FILE"
}

@test "execute_scripts: returns 0 when no scripts directory" {
    CONFIG_PATH="nonexistent/path"
    export CONFIG_PATH

    run bash -c "source '${CM_SCRIPTS}/execute-scripts.sh' && execute_scripts"
    assert_success
    assert_output --partial "No scripts/ directory found"
}

@test "execute_scripts: discovers and counts .sh files" {
    local scripts_dir="${REPO_DIR}/${CONFIG_PATH}/scripts"
    mkdir -p "$scripts_dir"

    # Create test scripts
    cat > "${scripts_dir}/00-first.sh" <<'EOF'
#!/bin/bash
echo "first script ran"
EOF
    cat > "${scripts_dir}/01-second.sh" <<'EOF'
#!/bin/bash
echo "second script ran"
EOF
    chmod +x "${scripts_dir}"/*.sh

    run bash -c "
        export REPO_DIR='$REPO_DIR'
        export CONFIG_PATH='$CONFIG_PATH'
        export LOG_FILE='$LOG_FILE'
        export LIB_DIR='$LIB_DIR'
        source '${CM_SCRIPTS}/execute-scripts.sh'
        execute_scripts
    "
    assert_success
    assert_output --partial "Found 2 script(s)"
}

@test "execute_scripts: runs scripts in alphabetical order" {
    local scripts_dir="${REPO_DIR}/${CONFIG_PATH}/scripts"
    mkdir -p "$scripts_dir"

    cat > "${scripts_dir}/02-second.sh" <<'EOF'
#!/bin/bash
echo "ORDER:second"
EOF
    cat > "${scripts_dir}/01-first.sh" <<'EOF'
#!/bin/bash
echo "ORDER:first"
EOF
    chmod +x "${scripts_dir}"/*.sh

    output=$(bash -c "
        export REPO_DIR='$REPO_DIR'
        export CONFIG_PATH='$CONFIG_PATH'
        export LOG_FILE='$LOG_FILE'
        export LIB_DIR='$LIB_DIR'
        source '${CM_SCRIPTS}/execute-scripts.sh'
        execute_scripts
    " 2>&1)

    # Verify first appears before second in output
    echo "$output" | grep -q "ORDER:first"
    echo "$output" | grep -q "ORDER:second"
    
    first_pos=$(echo "$output" | grep -n "ORDER:first" | head -1 | cut -d: -f1)
    second_pos=$(echo "$output" | grep -n "ORDER:second" | head -1 | cut -d: -f1)

    [ "$first_pos" -lt "$second_pos" ]
}

@test "execute_scripts: halts on script failure" {
    local scripts_dir="${REPO_DIR}/${CONFIG_PATH}/scripts"
    mkdir -p "$scripts_dir"

    cat > "${scripts_dir}/00-pass.sh" <<'EOF'
#!/bin/bash
echo "pass"
EOF
    cat > "${scripts_dir}/01-fail.sh" <<'EOF'
#!/bin/bash
echo "failing"
exit 1
EOF
    cat > "${scripts_dir}/02-never.sh" <<'EOF'
#!/bin/bash
echo "should never run"
EOF
    chmod +x "${scripts_dir}"/*.sh

    run bash -c "
        export REPO_DIR='$REPO_DIR'
        export CONFIG_PATH='$CONFIG_PATH'
        export LOG_FILE='$LOG_FILE'
        export LIB_DIR='$LIB_DIR'
        source '${CM_SCRIPTS}/execute-scripts.sh'
        execute_scripts
    "
    assert_failure
    assert_output --partial "FAILED"
    refute_output --partial "should never run"
}

@test "execute_scripts: ignores non-.sh files" {
    local scripts_dir="${REPO_DIR}/${CONFIG_PATH}/scripts"
    mkdir -p "$scripts_dir"

    cat > "${scripts_dir}/00-test.sh" <<'EOF'
#!/bin/bash
echo "real script"
EOF
    echo "not a script" > "${scripts_dir}/README.md"
    echo "not a script" > "${scripts_dir}/.gitkeep"
    chmod +x "${scripts_dir}/00-test.sh"

    run bash -c "
        export REPO_DIR='$REPO_DIR'
        export CONFIG_PATH='$CONFIG_PATH'
        export LOG_FILE='$LOG_FILE'
        export LIB_DIR='$LIB_DIR'
        source '${CM_SCRIPTS}/execute-scripts.sh'
        execute_scripts
    "
    assert_success
    assert_output --partial "Found 1 script(s)"
}
