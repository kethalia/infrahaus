FROM lizardbyte/sunshine:latest-archlinux

# Switch to root for setup
USER root

# Append [multilib] section to pacman.conf
RUN echo -e "\n[multilib]\nInclude = /etc/pacman.d/mirrorlist" >> /etc/pacman.conf

# Update package database
RUN pacman -Syu --noconfirm

# Install Steam + GUI dependencies (32-bit via multilib)
RUN pacman -Syu --noconfirm \
    sudo \
    steam \
    wayland \
    mesa \
    vulkan-intel \
    vulkan-radeon \
    xorg-server-xwayland \
    dbus \
    pulseaudio \
    libpulse \
    libx11 \
    libxrandr \
    libxcursor \
    libxss \
    libxcomposite \
    libxdamage \
    libxext \
    libxi \
    libxtst \
    libdrm \
    libva \
    gst-plugins-base \
    gstreamer

# Set up runtime directory (dynamic UID)
RUN mkdir -p /run/user/${USER_ID} && chown lizard:lizard /run/user/${USER_ID}

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Switch to non-root user (lizard, but with dynamic UID context)
USER lizard

ENTRYPOINT ["/entrypoint.sh"]
