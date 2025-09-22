#!/bin/bash

set -e

echo "🚀 Starting Steam under Wayland..."

export DISPLAY=:0
export XDG_RUNTIME_DIR=/run/user/${USER_ID}
export WAYLAND_DISPLAY=wayland-0
export SDL_VIDEODRIVER=wayland
export GDK_BACKEND=wayland
export QT_QPA_PLATFORM=wayland

# Start D-Bus (if not running)
if ! pgrep dbus-daemon > /dev/null; then
    echo "🔧 Starting D-Bus..."
    dbus-launch --exit-with-session &
fi

# Start PulseAudio
echo "🔊 Starting PulseAudio..."
pulseaudio --start --daemonize

sleep 3

# Launch Steam in background
echo "🎮 Launching Steam..."
steam -silent &

# Wait until Steam is running
echo "⏳ Waiting for Steam to start..."
until pgrep steam > /dev/null; do sleep 1; done

sleep 5

# Now launch Sunshine
echo "📡 Starting Sunshine..."
exec sunshine --loglevel=info "$@"
