#!/usr/bin/env bash
# 41_security-solidity.sh — Install Solidity-specific security analysis tools
#
# Installs: Slither (pipx), Aderyn (installer), Echidna (binary),
#           Mythril (pipx with fallback), Solhint (npm)
#
# Requires:
#   - pipx (from 11_python.sh) for Slither and Mythril
#   - npm  (from 10_node.sh)   for Solhint
#   - Rust toolchain (from 13_rust.sh) may be needed by Aderyn installer
#   - USERNAME env var
# Runs as: root inside the LXC container

set -euo pipefail

LOG_PREFIX="[41_security-solidity]"

log() {
    echo "${LOG_PREFIX} $*"
}

log "=== Installing Solidity security tools ==="

# ---------------------------------------------------------------------------
# Slither — Solidity static analyzer (via pipx, as non-root user)
# ---------------------------------------------------------------------------
log "Checking Slither..."
if su - "${USERNAME}" -c "command -v slither" &>/dev/null; then
    SLITHER_VER=$(su - "${USERNAME}" -c "slither --version 2>/dev/null || echo unknown")
    log "Slither already installed: ${SLITHER_VER} — skipping"
else
    log "Installing Slither via pipx..."
    su - "${USERNAME}" -c "pipx install slither-analyzer"
    SLITHER_VER=$(su - "${USERNAME}" -c "slither --version 2>/dev/null || echo installed")
    log "Slither installed: ${SLITHER_VER}"
fi

# ---------------------------------------------------------------------------
# Aderyn — Rust-based Solidity analyzer (via official installer, as user)
# ---------------------------------------------------------------------------
log "Checking Aderyn..."
if su - "${USERNAME}" -c "command -v aderyn" &>/dev/null; then
    ADERYN_VER=$(su - "${USERNAME}" -c "aderyn --version 2>/dev/null || echo unknown")
    log "Aderyn already installed: ${ADERYN_VER} — skipping"
else
    log "Installing Aderyn via official installer..."
    su - "${USERNAME}" -c "curl --proto '=https' --tlsv1.2 -LsSf \
        https://github.com/cyfrin/aderyn/releases/latest/download/aderyn-installer.sh | bash"
    ADERYN_VER=$(su - "${USERNAME}" -c "aderyn --version 2>/dev/null || echo installed")
    log "Aderyn installed: ${ADERYN_VER}"
fi

# ---------------------------------------------------------------------------
# Echidna — smart contract fuzzer (pre-built binary, system-wide)
# ---------------------------------------------------------------------------
log "Checking Echidna..."
if command -v echidna &>/dev/null; then
    log "Echidna already installed: $(echidna --version 2>/dev/null || echidna --help 2>&1 | head -1) — skipping"
else
    log "Fetching latest Echidna release..."
    ECHIDNA_VER=$(curl -s https://api.github.com/repos/crytic/echidna/releases/latest \
        | grep -oP '"tag_name":\s*"\K[^"]+')
    log "Installing Echidna ${ECHIDNA_VER}..."

    # Install unzip if needed (may not be in base image)
    if ! command -v unzip &>/dev/null; then
        apt-get install -y unzip
    fi

    wget -q "https://github.com/crytic/echidna/releases/download/${ECHIDNA_VER}/echidna-${ECHIDNA_VER}-Linux.zip" \
        -O /tmp/echidna.zip
    unzip -o /tmp/echidna.zip -d /tmp/echidna-extract
    find /tmp/echidna-extract -name echidna -type f -exec cp {} /usr/local/bin/echidna \;
    chmod +x /usr/local/bin/echidna
    rm -rf /tmp/echidna.zip /tmp/echidna-extract

    log "Echidna installed: $(echidna --version 2>/dev/null || echidna --help 2>&1 | head -1 || echo 'installed')"
fi

# ---------------------------------------------------------------------------
# Mythril — symbolic execution analyzer (via pipx, with fallback on failure)
#
# WARNING: z3 compilation can take 30+ minutes and may fail on Python 3.12.
#          Install failure does NOT abort the script (soft failure with notice).
# ---------------------------------------------------------------------------
log "Checking Mythril..."
if su - "${USERNAME}" -c "command -v myth" &>/dev/null; then
    MYTH_VER=$(su - "${USERNAME}" -c "myth version 2>/dev/null || echo unknown")
    log "Mythril already installed: ${MYTH_VER} — skipping"
else
    log "Installing z3 development libraries for Mythril..."
    apt-get install -y libz3-dev python3-z3 || true

    log "Attempting Mythril installation via pipx (timeout: 600s)..."
    log "NOTE: This step may take several minutes due to z3 compilation."
    if timeout 600 su - "${USERNAME}" -c "pipx install mythril" 2>/dev/null; then
        log "Mythril installed successfully"
    else
        log "WARNING: Mythril installation failed or timed out. Skipping."
        log "WARNING: Mythril can be installed manually later: pipx install mythril"
        log "WARNING: Common cause: z3 incompatibility with Python 3.12+"
    fi
fi

# ---------------------------------------------------------------------------
# Solhint — Solidity linter (via npm, as non-root user)
# ---------------------------------------------------------------------------
log "Checking Solhint..."
if su - "${USERNAME}" -c "command -v solhint" &>/dev/null; then
    SOLHINT_VER=$(su - "${USERNAME}" -c "solhint --version 2>/dev/null || echo unknown")
    log "Solhint already installed: ${SOLHINT_VER} — skipping"
else
    log "Installing Solhint via npm..."
    su - "${USERNAME}" -c "npm install -g solhint"
    SOLHINT_VER=$(su - "${USERNAME}" -c "solhint --version 2>/dev/null || echo installed")
    log "Solhint installed: ${SOLHINT_VER}"
fi

log "=== Solidity security tools installation complete ==="
