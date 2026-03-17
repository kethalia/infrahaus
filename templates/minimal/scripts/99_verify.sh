#!/usr/bin/env bash
set -euo pipefail
# 99_verify.sh -- Minimal template verification
# Checks that required tools are available

echo "[99_verify] Running verification checks..."

PASS=0
FAIL=0

check_command() {
    local cmd="$1"
    if command -v "$cmd" &>/dev/null; then
        echo "[99_verify]   [PASS] $cmd: $(command -v "$cmd")"
        ((PASS++))
    else
        echo "[99_verify]   [FAIL] $cmd: not found"
        ((FAIL++))
    fi
}

check_command curl
check_command git
check_command vim

echo ""
echo "[99_verify] Summary: $PASS passed, $FAIL failed"

if [[ $FAIL -gt 0 ]]; then
    echo "[99_verify] Verification FAILED"
    exit 1
fi

echo "[99_verify] Verification PASSED -- minimal template ready"
