export interface InfraService {
  id: string;
  name: string;
  description: string;
  category:
    | "ai"
    | "media"
    | "gaming"
    | "blockchain"
    | "deployment"
    | "networking"
    | "development";
  deployType: "docker-compose" | "lxc" | "vm" | "terraform";
  composePath?: string;
  docsPath?: string;
  services: string[];
  requiresGpu: boolean;
  tags: string[];
}

export const INFRA_CATALOG: InfraService[] = [
  {
    id: "ai-stack",
    name: "AI Stack",
    description:
      "Open WebUI, Ollama, Kokoro TTS, ComfyUI — GPU-accelerated LLM inference stack",
    category: "ai",
    deployType: "docker-compose",
    composePath: "infra/ai/docker-compose.yaml",
    docsPath: "/docs/ai",
    services: ["open-webui", "ollama", "kokoro-tts", "comfyui"],
    requiresGpu: true,
    tags: ["ai", "llm", "gpu"],
  },
  {
    id: "ollama-standalone",
    name: "Ollama (CPU)",
    description: "Ollama standalone — CPU inference, no GPU required",
    category: "ai",
    deployType: "docker-compose",
    composePath: "infra/ai/ollama/docker-compose.yaml",
    docsPath: "/docs/ai/ollama",
    services: ["ollama"],
    requiresGpu: false,
    tags: ["ai", "llm"],
  },
  {
    id: "jellyfin",
    name: "Jellyfin Media Server",
    description:
      "Jellyfin with VPN, qBittorrent, Prowlarr, Radarr, Sonarr, and Bazarr",
    category: "media",
    deployType: "docker-compose",
    composePath: "infra/jellyfin/docker-compose.yaml",
    docsPath: "/docs/media/jellyfin",
    services: [
      "jellyfin",
      "gluetun",
      "qbittorrent",
      "prowlarr",
      "radarr",
      "sonarr",
      "bazarr",
    ],
    requiresGpu: true,
    tags: ["media", "streaming", "gpu"],
  },
  {
    id: "gaming",
    name: "Cloud Gaming",
    description:
      "Sunshine + Steam with NVIDIA GPU passthrough for cloud gaming",
    category: "gaming",
    deployType: "docker-compose",
    composePath: "infra/gaming/docker-compose.yaml",
    docsPath: "/docs/gaming",
    services: ["sunshine", "steam"],
    requiresGpu: true,
    tags: ["gaming", "gpu", "sunshine"],
  },
  {
    id: "lukso-node",
    name: "LUKSO Node",
    description:
      "Geth + Lighthouse consensus/execution client with Prometheus and Grafana monitoring",
    category: "blockchain",
    deployType: "docker-compose",
    composePath: "infra/lukso-node/docker-compose.yaml",
    docsPath: "/docs/blockchain/lukso-node",
    services: ["geth", "lighthouse", "prometheus", "grafana"],
    requiresGpu: false,
    tags: ["blockchain", "lukso", "ethereum"],
  },
  {
    id: "dokploy",
    name: "Dokploy",
    description:
      "Self-hosted PaaS with Docker Swarm, Traefik reverse proxy, Postgres, and Redis",
    category: "deployment",
    deployType: "lxc",
    composePath: "infra/dokploy/docker-compose.yaml",
    docsPath: "/docs/deployment/dokploy",
    services: ["dokploy", "traefik", "postgres", "redis"],
    requiresGpu: false,
    tags: ["deployment", "paas", "docker", "infra"],
  },
  {
    id: "wireguard-proxy",
    name: "WireGuard Proxy",
    description:
      "WireGuard VPN with Nginx Proxy Manager for reverse proxy and SSL termination",
    category: "networking",
    deployType: "lxc",
    composePath: "infra/wireguard/docker-compose.yaml",
    docsPath: "/docs/networking/wireguard",
    services: ["wireguard", "nginx-proxy-manager"],
    requiresGpu: false,
    tags: ["networking", "vpn", "proxy", "infra"],
  },
  {
    id: "coder",
    name: "Coder Workspaces",
    description:
      "Cloud development workspaces via Coder — Terraform-provisioned containers with browser IDE",
    category: "development",
    deployType: "terraform",
    docsPath: "/docs/development",
    services: ["coder"],
    requiresGpu: false,
    tags: ["development", "ide", "terraform"],
  },
];
