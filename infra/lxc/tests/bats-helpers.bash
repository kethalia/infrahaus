#!/usr/bin/env bash
# bats-helpers.bash — Shared utilities for config-manager BATS tests

# Load BATS helper libraries
load '/usr/local/lib/bats-support/load'
load '/usr/local/lib/bats-assert/load'

# Project root (inside Docker container)
export PROJECT_ROOT="/workspace"
export CM_SCRIPTS="${PROJECT_ROOT}/infra/lxc/scripts/config-manager"
export CM_TESTS="${PROJECT_ROOT}/infra/lxc/tests"
export FIXTURES="${CM_TESTS}/fixtures"

# Standard config-manager directories
export CONFIG_FILE="/etc/config-manager/config.env"
export LOG_DIR="/var/log/config-manager"
export LOG_FILE="${LOG_DIR}/sync.log"
export REPO_DIR="/opt/config-manager/repo"
export LIB_DIR="/usr/local/lib/config-manager"
export LOCK_FILE="/run/config-manager/config-manager.lock"

# Setup mock repo as REPO_DIR
setup_mock_repo() {
    rm -rf "$REPO_DIR"
    mkdir -p "$REPO_DIR"
    # Copy the fixture mock-repo structure
    if [ -d "${FIXTURES}/mock-repo" ]; then
        cp -r "${FIXTURES}/mock-repo/"* "$REPO_DIR/" 2>/dev/null || true
    fi
}

# Setup config file
setup_config() {
    mkdir -p /etc/config-manager
    if [ -f "${FIXTURES}/config.env" ]; then
        cp "${FIXTURES}/config.env" "$CONFIG_FILE"
        chmod 600 "$CONFIG_FILE"
    fi
}

# Install helper scripts to LIB_DIR (copy from source)
install_helpers() {
    mkdir -p "${LIB_DIR}/package-handlers"
    
    # Copy main helper scripts
    [ -f "${CM_SCRIPTS}/config-manager-helpers.sh" ] && \
        cp "${CM_SCRIPTS}/config-manager-helpers.sh" "${LIB_DIR}/"
    [ -f "${CM_SCRIPTS}/execute-scripts.sh" ] && \
        cp "${CM_SCRIPTS}/execute-scripts.sh" "${LIB_DIR}/"
    [ -f "${CM_SCRIPTS}/process-files.sh" ] && \
        cp "${CM_SCRIPTS}/process-files.sh" "${LIB_DIR}/"
    [ -f "${CM_SCRIPTS}/snapshot-manager.sh" ] && \
        cp "${CM_SCRIPTS}/snapshot-manager.sh" "${LIB_DIR}/"
    [ -f "${CM_SCRIPTS}/conflict-detector.sh" ] && \
        cp "${CM_SCRIPTS}/conflict-detector.sh" "${LIB_DIR}/"
    
    # Copy package handlers
    if [ -d "${CM_SCRIPTS}/package-handlers" ]; then
        cp "${CM_SCRIPTS}/package-handlers/"*.sh "${LIB_DIR}/package-handlers/" 2>/dev/null || true
    fi
    
    chmod 755 "${LIB_DIR}/"*.sh 2>/dev/null || true
    chmod 755 "${LIB_DIR}/package-handlers/"*.sh 2>/dev/null || true
}

# Clean up after tests
cleanup_test_env() {
    rm -f "$LOCK_FILE"
    rm -f "$LOG_FILE"
    rm -f "$CONFIG_FILE"
    rm -rf "$REPO_DIR"/*
}

# Provide logging stubs for sourced scripts
setup_logging_stubs() {
    export -f log_info log_warn log_error 2>/dev/null || true
}
