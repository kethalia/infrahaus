#!/usr/bin/env bash
# handler-logging.sh — Shared logging utilities for package handlers.
#
# This file provides standardized logging functions that can be sourced
# by all package handlers. When handlers are sourced from config-sync.sh,
# they use the parent's logging functions. When run standalone, they use
# these stubs.
#
# Functions exported:
#   source_logging_stubs — Initialize logging functions if not already defined
#
# This file is safe to source multiple times (idempotent guard).

# Guard against double-sourcing
[[ -n "${_HANDLER_LOGGING_LOADED:-}" ]] && return 0
readonly _HANDLER_LOGGING_LOADED=1

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
readonly LOG_LEVEL_WIDTH=7  # Width for level column (fits "WARNING")

# ---------------------------------------------------------------------------
# source_logging_stubs — Initialize logging functions if not already defined
#
# This function checks if logging functions are already available (from
# config-sync.sh or similar) and only defines fallback implementations
# if they're not present.
# ---------------------------------------------------------------------------
source_logging_stubs() {
    if ! declare -f log_info &>/dev/null; then
        _log() {
            local level="$1"; shift
            printf '[%s] [%-'"${LOG_LEVEL_WIDTH}"'s] %s\n' \
                "$(date '+%Y-%m-%d %H:%M:%S')" "$level" "$*"
        }
        log_info()  { _log INFO    "$@"; }
        log_warn()  { _log WARNING "$@"; }
        log_error() { _log ERROR   "$@"; }
    fi
}
