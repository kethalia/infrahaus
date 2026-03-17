#!/usr/bin/env bash
set -euo pipefail
# zap-scan.sh -- Run OWASP ZAP baseline scan against a target URL

TARGET_URL="${1:-}"
if [[ -z "$TARGET_URL" ]]; then
    echo "Usage: zap-scan.sh <target-url> [report-dir]"
    echo "Example: zap-scan.sh http://localhost:3000"
    exit 1
fi

REPORT_DIR="${2:-.security-reports}"
mkdir -p "$REPORT_DIR"

echo "=== ZAP Baseline Scan ==="
echo "Target: $TARGET_URL"
echo "Reports: $REPORT_DIR/"
echo ""

# Run ZAP in headless/command-line mode
if command -v zap &>/dev/null; then
    zap -cmd -quickurl "$TARGET_URL" \
        -quickout "$REPORT_DIR/zap-report.html" \
        -quickprogress 2>&1 || true

    echo ""
    echo "Report saved to: $REPORT_DIR/zap-report.html"
    echo "[DONE] ZAP scan complete"
else
    echo "ERROR: ZAP not found. Install with: apt install zaproxy"
    exit 1
fi
