#!/usr/bin/env bash
set -euo pipefail
# security-gate.sh -- Run all security tools against the current project

PROJECT_DIR="${1:-.}"
REPORT_DIR="${PROJECT_DIR}/.security-reports"
mkdir -p "$REPORT_DIR"

echo "=== Security Gate -- $(date) ==="
echo "Project: $PROJECT_DIR"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

# Gitleaks -- secret detection
echo "--- Gitleaks (Secret Detection) ---"
if gitleaks detect --source "$PROJECT_DIR" --report-path "$REPORT_DIR/gitleaks.json" --report-format json 2>/dev/null; then
    echo "  [PASS] No secrets detected"
    ((PASSED++))
else
    echo "  [FAIL] Secrets detected! See $REPORT_DIR/gitleaks.json"
    ((FAILED++))
fi

# Semgrep -- static analysis
echo "--- Semgrep (Static Analysis) ---"
if semgrep scan --config auto "$PROJECT_DIR" --json -o "$REPORT_DIR/semgrep.json" 2>/dev/null; then
    echo "  [PASS] Semgrep scan complete. See $REPORT_DIR/semgrep.json"
    ((PASSED++))
else
    echo "  [WARN] Semgrep found issues. See $REPORT_DIR/semgrep.json"
    ((WARNINGS++))
fi

# Trivy -- filesystem vulnerability scan
echo "--- Trivy (Vulnerability Scan) ---"
if trivy fs "$PROJECT_DIR" --format json -o "$REPORT_DIR/trivy.json" 2>/dev/null; then
    echo "  [PASS] Trivy scan complete. See $REPORT_DIR/trivy.json"
    ((PASSED++))
else
    echo "  [WARN] Trivy found vulnerabilities. See $REPORT_DIR/trivy.json"
    ((WARNINGS++))
fi

# Slither -- Solidity analysis (only if foundry.toml or hardhat.config exists)
if [[ -f "$PROJECT_DIR/foundry.toml" ]] || [[ -f "$PROJECT_DIR/hardhat.config.js" ]] || [[ -f "$PROJECT_DIR/hardhat.config.ts" ]]; then
    echo "--- Slither (Solidity Analysis) ---"
    if slither "$PROJECT_DIR" --json "$REPORT_DIR/slither.json" 2>/dev/null; then
        echo "  [PASS] Slither scan complete. See $REPORT_DIR/slither.json"
        ((PASSED++))
    else
        echo "  [WARN] Slither found issues. See $REPORT_DIR/slither.json"
        ((WARNINGS++))
    fi
fi

echo ""
echo "=== Security Gate Summary ==="
echo "  Passed:   $PASSED"
echo "  Warnings: $WARNINGS"
echo "  Failed:   $FAILED"
echo "  Reports:  $REPORT_DIR/"

if [[ $FAILED -gt 0 ]]; then
    echo ""
    echo "[FAIL] SECURITY GATE FAILED -- Fix critical issues before proceeding"
    exit 1
else
    echo ""
    echo "[PASS] SECURITY GATE PASSED"
    exit 0
fi
