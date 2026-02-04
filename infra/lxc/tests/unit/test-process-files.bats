#!/usr/bin/env bats
# test-process-files.bats — Unit tests for process-files.sh

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
    rm -rf /tmp/test-deploy
}

@test "process_files: returns 0 when no files directory" {
    CONFIG_PATH="nonexistent/path"
    run bash -c "
        export REPO_DIR='$REPO_DIR'
        export CONFIG_PATH='$CONFIG_PATH'
        export LOG_FILE='$LOG_FILE'
        export LIB_DIR='$LIB_DIR'
        source '${CM_SCRIPTS}/process-files.sh'
        process_files
    "
    assert_success
    assert_output --partial "No files/ directory found"
}

@test "process_files: deploys file triplet with replace policy" {
    local files_dir="${REPO_DIR}/${CONFIG_PATH}/files"
    mkdir -p "$files_dir" /tmp/test-deploy

    echo "file content here" > "${files_dir}/myconfig"
    echo "/tmp/test-deploy" > "${files_dir}/myconfig.path"
    echo "replace" > "${files_dir}/myconfig.policy"

    run bash -c "
        export REPO_DIR='$REPO_DIR'
        export CONFIG_PATH='$CONFIG_PATH'
        export LOG_FILE='$LOG_FILE'
        export LIB_DIR='$LIB_DIR'
        source '${CM_SCRIPTS}/process-files.sh'
        process_files
    "
    assert_success

    # Verify file was deployed
    [ -f "/tmp/test-deploy/myconfig" ]
    run cat "/tmp/test-deploy/myconfig"
    assert_output "file content here"
}

@test "process_files: default policy doesn't overwrite existing" {
    local files_dir="${REPO_DIR}/${CONFIG_PATH}/files"
    mkdir -p "$files_dir" /tmp/test-deploy

    echo "new content" > "${files_dir}/existing"
    echo "/tmp/test-deploy" > "${files_dir}/existing.path"
    echo "default" > "${files_dir}/existing.policy"

    # Pre-create the target file
    echo "original content" > "/tmp/test-deploy/existing"

    run bash -c "
        export REPO_DIR='$REPO_DIR'
        export CONFIG_PATH='$CONFIG_PATH'
        export LOG_FILE='$LOG_FILE'
        export LIB_DIR='$LIB_DIR'
        source '${CM_SCRIPTS}/process-files.sh'
        process_files
    "
    assert_success

    # File should NOT be overwritten with default policy
    run cat "/tmp/test-deploy/existing"
    assert_output "original content"
}

@test "process_files: replace policy overwrites existing" {
    local files_dir="${REPO_DIR}/${CONFIG_PATH}/files"
    mkdir -p "$files_dir" /tmp/test-deploy

    echo "new content" > "${files_dir}/existing"
    echo "/tmp/test-deploy" > "${files_dir}/existing.path"
    echo "replace" > "${files_dir}/existing.policy"

    # Pre-create the target file
    echo "original content" > "/tmp/test-deploy/existing"

    run bash -c "
        export REPO_DIR='$REPO_DIR'
        export CONFIG_PATH='$CONFIG_PATH'
        export LOG_FILE='$LOG_FILE'
        export LIB_DIR='$LIB_DIR'
        source '${CM_SCRIPTS}/process-files.sh'
        process_files
    "
    assert_success

    # File SHOULD be overwritten with replace policy
    run cat "/tmp/test-deploy/existing"
    assert_output "new content"
}

@test "process_files: skips files without .path sidecar" {
    local files_dir="${REPO_DIR}/${CONFIG_PATH}/files"
    mkdir -p "$files_dir"

    echo "orphan content" > "${files_dir}/orphan"
    # No .path file - should be skipped

    run bash -c "
        export REPO_DIR='$REPO_DIR'
        export CONFIG_PATH='$CONFIG_PATH'
        export LOG_FILE='$LOG_FILE'
        export LIB_DIR='$LIB_DIR'
        source '${CM_SCRIPTS}/process-files.sh'
        process_files
    "
    assert_success
    # Should not fail, just skip the orphan file
}
