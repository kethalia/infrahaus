#!/usr/bin/env bash
# 40_security-web.sh — Install web/general security analysis tools
#
# Installs: Semgrep (via pipx), Trivy (binary), Gitleaks (binary)
# Note: nmap and nikto are installed via apt packages in template.yaml
#
# Requires: pipx (from 11_python.sh), USERNAME env var
# Runs as: root inside the LXC container

set -euo pipefail

LOG_PREFIX="[40_security-web]"

log() {
    echo "${LOG_PREFIX} $*"
}

log "=== Installing web/general security tools ==="

# ---------------------------------------------------------------------------
# Semgrep — multi-language static analysis (via pipx, as non-root user)
# ---------------------------------------------------------------------------
log "Checking Semgrep..."
if su - "${USERNAME}" -c "command -v semgrep" &>/dev/null; then
    SEMGREP_VER=$(su - "${USERNAME}" -c "semgrep --version 2>/dev/null || echo unknown")
    log "Semgrep already installed: ${SEMGREP_VER} — skipping"
else
    log "Installing Semgrep via pipx..."
    su - "${USERNAME}" -c "pipx install semgrep"
    SEMGREP_VER=$(su - "${USERNAME}" -c "semgrep --version")
    log "Semgrep installed: ${SEMGREP_VER}"
fi

# ---------------------------------------------------------------------------
# Trivy — container/filesystem vulnerability scanner (system binary)
# ---------------------------------------------------------------------------
log "Checking Trivy..."
if command -v trivy &>/dev/null; then
    log "Trivy already installed: $(trivy --version 2>&1 | head -1) — skipping"
else
    log "Fetching latest Trivy release version..."
    TRIVY_VER=$(curl -s https://api.github.com/repos/aquasecurity/trivy/releases/latest \
        | grep -oP '"tag_name":\s*"v\K[^"]+')
    log "Installing Trivy v${TRIVY_VER}..."
    wget -q "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VER}/trivy_${TRIVY_VER}_Linux-64bit.tar.gz" \
        -O /tmp/trivy.tar.gz
    tar xzf /tmp/trivy.tar.gz -C /usr/local/bin trivy
    chmod +x /usr/local/bin/trivy
    rm /tmp/trivy.tar.gz
    log "Trivy installed: $(trivy --version 2>&1 | head -1)"
fi

# ---------------------------------------------------------------------------
# Gitleaks — secret detection in git repositories (system binary)
# ---------------------------------------------------------------------------
log "Checking Gitleaks..."
if command -v gitleaks &>/dev/null; then
    log "Gitleaks already installed: $(gitleaks version 2>&1) — skipping"
else
    log "Fetching latest Gitleaks release version..."
    GITLEAKS_VER=$(curl -s https://api.github.com/repos/gitleaks/gitleaks/releases/latest \
        | grep -oP '"tag_name":\s*"v\K[^"]+')
    log "Installing Gitleaks v${GITLEAKS_VER}..."
    wget -q "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VER}/gitleaks_${GITLEAKS_VER}_linux_x64.tar.gz" \
        -O /tmp/gitleaks.tar.gz
    tar xzf /tmp/gitleaks.tar.gz -C /usr/local/bin gitleaks
    chmod +x /usr/local/bin/gitleaks
    rm /tmp/gitleaks.tar.gz
    log "Gitleaks installed: $(gitleaks version 2>&1)"
fi

# ---------------------------------------------------------------------------
# nmap + nikto — installed via apt packages in template.yaml, just verify
# ---------------------------------------------------------------------------
log "Verifying nmap (installed via apt)..."
if command -v nmap &>/dev/null; then
    log "nmap: $(nmap --version 2>&1 | head -1)"
else
    log "WARNING: nmap not found — ensure it is listed in template.yaml apt packages"
fi

log "Verifying nikto (installed via apt)..."
if command -v nikto &>/dev/null; then
    log "nikto: $(nikto -Version 2>&1 | head -2 || echo 'installed')"
else
    log "WARNING: nikto not found — ensure it is listed in template.yaml apt packages"
fi

log "=== Web/general security tools installation complete ==="
