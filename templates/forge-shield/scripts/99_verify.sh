#!/usr/bin/env bash
# 99_verify.sh — Final verification of all installed tools in forge-shield template
# Runs as root inside the LXC container. USERNAME env var must be set.
# This is the LAST script to run. It checks every tool and produces a summary.
set -uo pipefail

LOG_PREFIX="[99_verify]"

log() { echo "${LOG_PREFIX} $*"; }

: "${USERNAME:?USERNAME env var must be set}"

log "Starting final tool verification for user: ${USERNAME}"
echo ""

PASS=0
FAIL=0
OPTIONAL_FAIL=0

# Helper: check a command (as root)
check_root() {
    local name="$1"
    local cmd="$2"
    local optional="${3:-false}"
    if command -v "$cmd" &>/dev/null; then
        echo "  PASS $name"
        PASS=$((PASS + 1))
    else
        if [[ "$optional" == "true" ]]; then
            echo "  SKIP $name (optional — not installed)"
            OPTIONAL_FAIL=$((OPTIONAL_FAIL + 1))
        else
            echo "  FAIL $name (NOT FOUND)"
            FAIL=$((FAIL + 1))
        fi
    fi
}

# Helper: check a command (as the non-root user, with login profile)
check_user() {
    local name="$1"
    local cmd="$2"
    local optional="${3:-false}"
    if su - "${USERNAME}" -c "command -v $cmd" &>/dev/null; then
        echo "  PASS $name"
        PASS=$((PASS + 1))
    else
        if [[ "$optional" == "true" ]]; then
            echo "  SKIP $name (optional — not installed)"
            OPTIONAL_FAIL=$((OPTIONAL_FAIL + 1))
        else
            echo "  FAIL $name (NOT FOUND)"
            FAIL=$((FAIL + 1))
        fi
    fi
}

# Helper: check a file/path exists
check_path() {
    local name="$1"
    local path="$2"
    local optional="${3:-false}"
    if [[ -e "$path" ]]; then
        echo "  PASS $name"
        PASS=$((PASS + 1))
    else
        if [[ "$optional" == "true" ]]; then
            echo "  SKIP $name (optional — not found at $path)"
            OPTIONAL_FAIL=$((OPTIONAL_FAIL + 1))
        else
            echo "  FAIL $name (NOT FOUND at $path)"
            FAIL=$((FAIL + 1))
        fi
    fi
}

# ─── Languages ────────────────────────────────────────────────────────────────
echo "--- Languages ---"
check_user  "node (Node.js)"      node
check_user  "npm"                 npm
check_root  "python3"             python3
check_user  "go (Go)"            go
check_user  "rustc (Rust)"       rustc
check_user  "cargo (Rust)"       cargo
echo ""

# ─── EVM Dev Tools ───────────────────────────────────────────────────────────
echo "--- EVM Dev Tools ---"
check_user  "forge (Foundry)"    forge
check_user  "cast (Foundry)"     cast
check_user  "anvil (Foundry)"    anvil
check_user  "solc-select"        solc-select
check_user  "solhint"            solhint
echo ""

# ─── Security (Solidity) ─────────────────────────────────────────────────────
echo "--- Security: Solidity ---"
check_user  "slither"            slither
check_user  "aderyn"             aderyn
check_user  "echidna"            echidna
check_user  "myth (Mythril)"     myth     "true"
echo ""

# ─── Security (Web / General) ────────────────────────────────────────────────
echo "--- Security: Web / General ---"
check_user  "semgrep"            semgrep
check_root  "trivy"              trivy
check_root  "gitleaks"           gitleaks
check_root  "nmap"               nmap
check_root  "nikto"              nikto
echo ""

# ─── AI / Productivity ───────────────────────────────────────────────────────
echo "--- AI / Productivity ---"
check_user  "claude (Claude Code CLI)"  claude
check_user  "opencode"           opencode  "true"
echo ""

# ─── Shell ───────────────────────────────────────────────────────────────────
echo "--- Shell ---"
check_root  "zsh"                zsh
echo ""

# ─── ZAP ─────────────────────────────────────────────────────────────────────
echo "--- OWASP ZAP ---"
check_path  "ZAP (/opt/zaproxy/zap.sh)"  "/opt/zaproxy/zap.sh"  "true"
echo ""

# ─── Critical tool directories ───────────────────────────────────────────────
echo "--- Claude Skill Directories ---"
check_path  "~/.claude/commands"  "/home/${USERNAME}/.claude/commands"
check_path  "~/.claude/skills"    "/home/${USERNAME}/.claude/skills"
echo ""

# ─── Shell configuration ─────────────────────────────────────────────────────
echo "--- Shell Configuration ---"
if [[ -f "/home/${USERNAME}/.zshrc" ]]; then
    if grep -q "# forge-shield shell config" "/home/${USERNAME}/.zshrc"; then
        echo "  PASS .zshrc has forge-shield configuration"
        PASS=$((PASS + 1))
    else
        echo "  FAIL .zshrc exists but missing forge-shield marker"
        FAIL=$((FAIL + 1))
    fi
else
    echo "  FAIL .zshrc not found"
    FAIL=$((FAIL + 1))
fi

if [[ -d "/home/${USERNAME}/.oh-my-zsh" ]]; then
    echo "  PASS oh-my-zsh installed"
    PASS=$((PASS + 1))
else
    echo "  SKIP oh-my-zsh not installed (optional)"
    OPTIONAL_FAIL=$((OPTIONAL_FAIL + 1))
fi
echo ""

# ─── Summary ─────────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL + OPTIONAL_FAIL))
log "Verification summary: ${PASS}/${TOTAL} tools verified"
log "  Passed:   ${PASS}"
log "  Failed:   ${FAIL} (critical)"
log "  Skipped:  ${OPTIONAL_FAIL} (optional)"

if [[ "$FAIL" -gt 0 ]]; then
    log "RESULT: FAILED — ${FAIL} critical tool(s) missing"
    log "Critical tools: node, python3, go, rustc, forge, slither, aderyn, echidna, semgrep, trivy, gitleaks, nmap, nikto, claude, zsh"
    exit 1
else
    log "RESULT: PASSED — all critical tools verified"
    exit 0
fi
