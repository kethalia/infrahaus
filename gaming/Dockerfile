# Use sunshine base image
FROM lizardbyte/sunshine:latest-ubuntu-24.04

# Update and install Steam + dependencies
RUN sudo apt update && apt install -y steam 

# Start Sunshine (default entrypoint)
ENTRYPOINT ["/usr/bin/sunshine"]