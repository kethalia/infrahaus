FROM ubuntu

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get upgrade --yes --no-install-recommends --no-install-suggests \
    && apt-get install --yes --no-install-recommends --no-install-suggests \
        ca-certificates \
        curl \
    && rm -rf /var/lib/apt/lists/*

# Add Docker's official GPG key:
RUN install -m 0755 -d /etc/apt/keyrings \
    && curl \
        -fsSL https://download.docker.com/linux/ubuntu/gpg \
        -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
RUN echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update and get default packages
RUN apt-get update \
    && apt-get install --yes --no-install-recommends --no-install-suggests \
        ca-certificates \
        bash \
        build-essential \
        containerd.io \
        docker-ce \
        docker-ce-cli \
        docker-buildx-plugin \
        docker-compose-plugin \
        htop \
        jq \
        locales \
        man \
        pipx \
        python3 \
        python3-pip \
        software-properties-common \
        sudo \
        systemd \
        systemd-sysv \
        unzip \
        vim \
        wget \
        rsync \
        zsh \
        fonts-powerline \
        postgresql-16 \
        postgresql-contrib-16 \
    && add-apt-repository ppa:git-core/ppa -y \
    && apt-get install -y git \
    && add-apt-repository universe -y \
    && apt-get install -y fonts-firacode\
    && rm -rf /var/lib/apt/lists/*

RUN systemctl enable docker
RUN ln -s /usr/libexec/docker/cli-plugins/docker-compose /usr/bin/docker-compose
RUN locale-gen en_US.UTF-8

ENV LANG=en_US.UTF-8
ENV LANGUAGE=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

RUN userdel -r ubuntu \
    && useradd coder \
        --create-home \
        --shell=/bin/zsh \
        --groups=docker \
        --uid=1000 \
        --user-group \
    && echo "coder ALL=(ALL) NOPASSWD:ALL" >>/etc/sudoers.d/nopasswd # buildkit

USER coder

# adds user's bin directory to PATH
RUN pipx ensurepath
