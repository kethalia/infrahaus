#!/bin/bash
# config-manager-status.sh — Login-time status display for config-manager
#
# This script runs on every interactive bash login and checks if config-manager
# is currently running. If so, it auto-follows the service logs and waits for
# completion before releasing the user to their prompt.
#
# Deployed to: /etc/profile.d/config-manager-status.sh

# Only run for interactive shells
[[ $- != *i* ]] && return 0

# Only run for login shells (avoid re-running on subshells)
shopt -q login_shell 2>/dev/null || return 0

_cm_status() {
    local state
    state="$(systemctl is-active config-manager.service 2>/dev/null)" || state="unknown"

    case "$state" in
        active|activating)
            printf '\n\033[1;33m'  # Bold yellow
            cat <<'EOF'
╔══════════════════════════════════════════════════╗
║  config-manager is running — initial setup      ║
╠══════════════════════════════════════════════════╣
║  Live logs below. Press Ctrl+C when done.       ║
╚══════════════════════════════════════════════════╝
EOF
            printf '\033[0m\n'

            # Show recent context (last 10 lines) then follow
            journalctl -u config-manager --no-pager -n 10 -o cat 2>/dev/null

            echo ""
            echo "─── live tail ───"
            echo ""

            # Follow until service stops or user presses Ctrl+C
            journalctl -u config-manager -f -o cat 2>/dev/null &
            local tail_pid=$!

            # Background watcher: kill tail when service finishes
            (
                while systemctl is-active --quiet config-manager.service 2>/dev/null; do
                    sleep 1
                done
                kill "$tail_pid" 2>/dev/null
            ) &
            local watcher_pid=$!

            # Wait for tail to end (either Ctrl+C or service completion)
            wait "$tail_pid" 2>/dev/null

            # Clean up watcher
            kill "$watcher_pid" 2>/dev/null
            wait "$watcher_pid" 2>/dev/null

            echo ""

            # Show final status
            if systemctl is-failed --quiet config-manager.service 2>/dev/null; then
                printf '\033[1;31m'  # Bold red
                echo ">>> config-manager FAILED. Check: journalctl -u config-manager"
                printf '\033[0m'
            else
                printf '\033[1;32m'  # Bold green
                echo ">>> config-manager completed successfully."
                printf '\033[0m'
            fi
            echo ""
            ;;

        failed)
            printf '\n\033[1;31m'  # Bold red
            cat <<'EOF'
╔══════════════════════════════════════════════════╗
║  WARNING: config-manager failed during setup    ║
╚══════════════════════════════════════════════════╝
EOF
            printf '\033[0m'
            echo ""
            echo "Check logs: journalctl -u config-manager --no-pager"
            echo ""
            ;;

        inactive|unknown)
            # Service is not running — normal state, show nothing
            :
            ;;
    esac
}

_cm_status
unset -f _cm_status
