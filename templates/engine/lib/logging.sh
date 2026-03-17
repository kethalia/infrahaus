#\!/usr/bin/env bash
# logging.sh — Colored terminal output with log levels
# Designed to be sourced (not executed directly).
# All output goes to stderr to keep stdout clean for machine parsing.

# Log level (default: info)
# Supported: debug, info, warn, error
LOG_LEVEL="${LOG_LEVEL:-info}"

# ANSI color codes — only when stderr is a terminal
_log_use_color() {
    [[ -t 2 ]]
}

_log_reset='\033[0m'
_log_gray='\033[0;90m'
_log_blue='\033[0;34m'
_log_yellow='\033[0;33m'
_log_red='\033[0;31m'
_log_green='\033[0;32m'
_log_bold_green='\033[1;32m'

# Internal: print a colored/plain message to stderr
_log_print() {
    local color="$1"
    local prefix="$2"
    local msg="$3"

    if _log_use_color; then
        printf "${color}%s${_log_reset} %s\n" "$prefix" "$msg" >&2
    else
        printf "%s %s\n" "$prefix" "$msg" >&2
    fi
}

# log_debug "message" — gray, only shown when LOG_LEVEL=debug
log_debug() {
    [[ "$LOG_LEVEL" == "debug" ]] || return 0
    _log_print "$_log_gray" "[DEBUG]" "$*"
}

# log_info "message" — blue [INFO] prefix
log_info() {
    case "$LOG_LEVEL" in
        debug|info) ;;
        *) return 0 ;;
    esac
    _log_print "$_log_blue" "[INFO]" "$*"
}

# log_warn "message" — yellow [WARN] prefix
log_warn() {
    case "$LOG_LEVEL" in
        debug|info|warn) ;;
        *) return 0 ;;
    esac
    _log_print "$_log_yellow" "[WARN]" "$*"
}

# log_error "message" — red [ERROR] prefix
log_error() {
    _log_print "$_log_red" "[ERROR]" "$*"
}

# log_step "message" — bold green [STEP] prefix, for major phase transitions
log_step() {
    _log_print "$_log_bold_green" "[STEP]" "$*"
}

# log_success "message" — green [OK] prefix
log_success() {
    _log_print "$_log_green" "[OK]" "$*"
}
