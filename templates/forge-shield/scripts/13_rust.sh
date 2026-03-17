#!/usr/bin/env bash
# 13_rust.sh — Install Rust via rustup for the non-root user
# Runs as root inside the container. USERNAME env var must be set.
# NOTE: Rust is installed as the non-root user (NOT as root) because
#       rustup is a user-level tool. cargo's bin dir PATH is handled
#       by the engine's env phase via PATH_APPEND in template.yaml.
set -euo pipefail

LOG_PREFIX="[13_rust]"

log() { echo "${LOG_PREFIX} $*"; }

if [[ -z "${USERNAME:-}" ]]; then
  echo "${LOG_PREFIX} ERROR: USERNAME env var must be set." >&2
  exit 1
fi

# Guard: skip if rustc is already installed for the user
if su - "${USERNAME}" -c "command -v rustc" &>/dev/null; then
  log "Rust already installed for ${USERNAME}: $(su - "${USERNAME}" -c "rustc --version")"
  exit 0
fi

log "Installing Rust via rustup for user '${USERNAME}'..."

# Install rustup as the non-root user with stable toolchain, no prompts
su - "${USERNAME}" -c \
  "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable"

# Verify both rustc and cargo are available
log "Verifying Rust installation for ${USERNAME}..."
su - "${USERNAME}" -c "source ~/.cargo/env && rustc --version && cargo --version"

log "Rust installation complete for ${USERNAME}."
