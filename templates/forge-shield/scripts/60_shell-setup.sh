#!/usr/bin/env bash
# 60_shell-setup.sh — Configure Zsh with oh-my-zsh and useful defaults (idempotent)
# Depends on: 10_node.sh (npm-global in PATH), 13_rust.sh (cargo/env)
# Runs as root inside the LXC container. USERNAME env var must be set.
set -euo pipefail

LOG_PREFIX="[60_shell-setup]"

log() { echo "${LOG_PREFIX} $*"; }

: "${USERNAME:?USERNAME env var must be set}"

# Guard: skip if .zshrc already has forge-shield marker
if [[ -f "/home/${USERNAME}/.zshrc" ]] && \
   grep -q "# forge-shield shell config" "/home/${USERNAME}/.zshrc" 2>/dev/null; then
    log "Shell already configured (forge-shield marker found) — skipping"
    exit 0
fi

log "Configuring Zsh with oh-my-zsh for user: ${USERNAME}"

# Install Zsh if not present
if ! command -v zsh &>/dev/null; then
    log "Installing Zsh..."
    apt-get install -y zsh
fi
log "Zsh available: $(zsh --version)"

# Install oh-my-zsh unattended (will not overwrite existing .zshrc with --keep-zshrc behavior)
if [[ ! -d "/home/${USERNAME}/.oh-my-zsh" ]]; then
    log "Installing oh-my-zsh for ${USERNAME}..."
    su - "${USERNAME}" -c 'sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended'
    log "oh-my-zsh installed"
else
    log "oh-my-zsh already installed — skipping install"
fi

# Configure .zshrc with forge-shield settings
log "Configuring .zshrc with forge-shield settings..."
cat >> "/home/${USERNAME}/.zshrc" << 'ZSHRC'

# forge-shield shell config — added by 60_shell-setup.sh

# Theme (oh-my-zsh default)
ZSH_THEME="robbyrussell"

# Plugins
plugins=(git docker node npm python rust golang fzf)

# PATH: all tool directories
export PATH="$HOME/.foundry/bin:$HOME/.cargo/bin:$HOME/go/bin:$HOME/.local/bin:$HOME/.npm-global/bin:$PATH"

# Source Cargo env if present (installed by 13_rust.sh)
[[ -f "$HOME/.cargo/env" ]] && source "$HOME/.cargo/env"

# Useful aliases
alias ll='ls -alF'
alias la='ls -A'
alias security-gate='~/.local/bin/security-gate.sh'
alias zap-scan='~/.local/bin/zap-scan.sh'
ZSHRC

log ".zshrc configured with forge-shield settings"

# Change default shell to Zsh
log "Changing default shell to Zsh for ${USERNAME}..."
chsh -s /bin/zsh "${USERNAME}"
log "Default shell set to Zsh"

# Ensure .zshrc is owned by user
chown "${USERNAME}:${USERNAME}" "/home/${USERNAME}/.zshrc"
log "Corrected ownership of .zshrc"

log "Shell setup complete — user ${USERNAME} will get Zsh with oh-my-zsh on next login"
