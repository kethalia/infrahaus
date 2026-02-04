#!/usr/bin/env bash
# Mock user setup script for testing
set -euo pipefail

log_info "=== Test User Setup ==="

if ! id -u testuser >/dev/null 2>&1; then
    log_info "Creating test user..."
    useradd -m -u 1500 -s /bin/bash testuser
    log_info "Test user created"
else
    log_info "Test user already exists"
fi

log_info "=== Test User Setup Complete ==="
