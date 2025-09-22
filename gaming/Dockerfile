FROM lizardbyte/sunshine:latest-archlinux

# Switch to root for setup
USER root

# Append [multilib] section to pacman.conf
RUN echo -e "\n[multilib]\nInclude = /etc/pacman.d/mirrorlist" >> /etc/pacman.conf

# Update package database
RUN pacman -Syu --noconfirm

# Install Steam + GUI dependencies (32-bit via multilib)
RUN pacman -Syu --noconfirm \
    nvidia-open \
    steam \
    pulseaudio \
    libpulse

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Switch to non-root user (lizard, but with dynamic UID context)
USER lizard

ENTRYPOINT ["/entrypoint.sh"]
