#!/usr/bin/env bash
set -euo pipefail
# post-deploy.sh -- Post-deployment summary for forge-shield template
# Runs INSIDE the container after all scripts have completed.

CTID="${CTID:-<CTID>}"
USERNAME="${USERNAME:-coder}"

echo "[post-deploy] forge-shield deployment complete"
echo ""
echo "  +--------------------------------------------------+"
echo "  |        forge-shield -- Deployment Complete        |"
echo "  +--------------------------------------------------+"
echo "  |  Connect: pct enter ${CTID}                      "
echo "  |  User:    ${USERNAME}                            "
echo "  |                                                   |"
echo "  |  Quick Start:                                     |"
echo "  |  1. su - ${USERNAME}                             "
echo "  |  2. claude  (authenticate Claude Code)            |"
echo "  |  3. mkdir project && cd project && forge init     |"
echo "  |  4. claude /security-gate                         |"
echo "  |                                                   |"
echo "  |  Available Commands:                              |"
echo "  |  /security-gate    -- Run all security tools      |"
echo "  |  /audit-solidity   -- Solidity-specific audit     |"
echo "  |  security-gate.sh  -- CLI security scan           |"
echo "  |  zap-scan.sh <url> -- Web app security scan       |"
echo "  +---------------------------------------------------+"
echo ""
echo "[post-deploy] Done"
