from debian:12

RUN apt-get update \
    && apt-get upgrade --yes --no-install-recommends --no-install-suggests \
    && apt-get install --yes --no-install-recommends --no-install-suggests \
        git \
        python3 \
        python3-pip \
        python3-venv \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 8188

RUN useradd runner --create-home
USER runner

WORKDIR /home/runner

RUN git clone https://github.com/comfyanonymous/ComfyUI.git

WORKDIR /home/runner/ComfyUI

COPY start.sh start.sh
USER root
RUN chmod +x start.sh
USER runner

RUN python3 -m venv comfy-ui
RUN . ./comfy-ui/bin/activate \
        && pip install torch torchvision torchaudio --extra-index-url https://download.pytorch.org/whl/cu129 \
        && pip install -r requirements.txt

CMD ["bash", "start.sh"]
