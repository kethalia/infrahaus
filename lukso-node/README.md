# LUKSO Docker Node

A minimal, production-ready Docker Compose setup for running a LUKSO mainnet node with Geth + Lighthouse and Grafana monitoring.

## Features

- **Snap sync** — syncs in hours, not weeks (~60GB storage vs 1.8TB/year for archive)
- **Auto-initialization** — genesis init runs automatically on first start
- **Health checks** — Lighthouse waits for Geth to be ready
- **Graceful shutdown** — 5-minute stop grace period prevents corruption
- **Pre-configured monitoring** — Grafana dashboard with Prometheus metrics
- **Configurable mount points** — single `DATA_DIR` variable for all data

## Requirements

- Docker & Docker Compose v2
- 4+ CPU cores, 16GB+ RAM
- 100GB+ SSD (NVMe recommended)
- Stable internet connection

## Quick Start

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/lukso-docker-node.git
cd lukso-docker-node

# Configure
cp .env.example .env
nano .env  # Set DATA_DIR and GRAFANA_ADMIN_PASSWORD

# Create data directories
sudo mkdir -p /mnt/lukso-node/{geth,lighthouse,configs}

# Copy your LUKSO network configs (genesis.json, jwt.hex, config.yaml, etc.)
# Get them from: https://github.com/lukso-network/network-configs
sudo cp /path/to/lukso-configs/* /mnt/lukso-node/configs/

# Start
docker compose up -d

# Watch logs
docker compose logs -f
```

## Configuration

All configuration is in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_DIR` | `/mnt/lukso-node` | Base path for all node data |
| `GETH_VERSION` | `v1.16.1` | Geth Docker image tag |
| `LIGHTHOUSE_VERSION` | `v7.0.1` | Lighthouse Docker image tag |
| `GETH_MAX_PEERS` | `50` | Maximum Geth peers |
| `LIGHTHOUSE_TARGET_PEERS` | `100` | Target Lighthouse peers |
| `GRAFANA_PORT` | `3000` | Grafana web UI port |
| `GRAFANA_ADMIN_PASSWORD` | - | **Required**: Set this! |

## Directory Structure

```
$DATA_DIR/
├── geth/           # Execution client data
├── lighthouse/     # Consensus client data
└── configs/        # Network configuration files
    ├── genesis.json
    ├── jwt.hex
    ├── config.yaml
    └── ...
```

## Network Configs

You need the official LUKSO network configuration files. Get them from:

```bash
git clone https://github.com/lukso-network/network-configs.git
sudo cp -r network-configs/mainnet/shared/* /mnt/lukso-node/configs/
```

Or generate a JWT secret if you don't have one:

```bash
openssl rand -hex 32 | sudo tee /mnt/lukso-node/configs/jwt.hex
```

## Monitoring

Grafana is available at `http://localhost:3000` (or your configured port).

Default credentials:
- Username: `admin`
- Password: (whatever you set in `GRAFANA_ADMIN_PASSWORD`)

The **LUKSO Node** dashboard is auto-provisioned and includes:
- Sync status and progress
- Peer counts (Geth + Lighthouse)
- Memory and disk usage
- Transaction pool stats
- RPC request rates
- Attestation metrics

## Endpoints

| Service | Port | Description |
|---------|------|-------------|
| Geth HTTP RPC | 8545 | JSON-RPC API |
| Geth WebSocket | 8546 | WebSocket API |
| Geth GraphQL | 8547 | GraphQL API |
| Geth P2P | 30303 | Peer discovery |
| Lighthouse HTTP | 5052 | Beacon API (localhost only) |
| Lighthouse P2P | 9000 | Peer discovery |
| Grafana | 3000 | Monitoring UI |
| Prometheus | 9090 | Metrics (localhost only) |

## Common Operations

### Check sync status

```bash
# Geth
curl -s http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}' | jq

# Lighthouse
curl -s http://localhost:5052/eth/v1/node/syncing | jq
```

### View logs

```bash
docker compose logs -f geth
docker compose logs -f lighthouse
docker compose logs -f --tail=100  # All services, last 100 lines
```

### Restart services

```bash
docker compose restart geth lighthouse
```

### Stop gracefully

```bash
docker compose down  # Waits up to 5 minutes for clean shutdown
```

### Update clients

```bash
# Edit .env with new versions
nano .env

# Pull and restart
docker compose pull
docker compose up -d
```

### Reset and resync

```bash
docker compose down
sudo rm -rf /mnt/lukso-node/geth/geth/chaindata
sudo rm -rf /mnt/lukso-node/geth/geth/triecache
docker compose up -d
```

## Troubleshooting

### "Failed to sync chain built on invalid parent"

Your Geth data is corrupted. Reset and resync:

```bash
docker compose down
sudo rm -rf $DATA_DIR/geth/geth/chaindata
sudo rm -rf $DATA_DIR/geth/geth/triecache
docker compose up -d
```

With snap sync, this takes hours instead of a week.

### Lighthouse fails to start

Check that Geth is healthy first:

```bash
docker compose ps
curl http://localhost:8545
```

Lighthouse waits for Geth's health check to pass before starting.

### Low peer count

- Ensure ports 30303 (TCP/UDP) and 9000 (TCP/UDP) are open
- Check your router/firewall settings
- The `--nat=extip:$(wget -qO- ifconfig.me)` auto-detects your public IP

### High disk usage

You might accidentally be running an archive node. Check your config:

```bash
docker compose exec geth geth --help | grep syncmode
```

This setup uses `--syncmode=snap` by default.

## Full Node vs Archive Node

This setup runs a **full node** (snap sync), which is sufficient for:

- ✅ Running a validator
- ✅ Sending transactions
- ✅ Querying current state
- ✅ Reading event logs (for indexers like Subsquid)
- ✅ Running dApps

You only need an archive node if you need to query historical state at arbitrary past blocks.

## Security Considerations

- Grafana and Prometheus are bound to localhost by default
- RPC endpoints are open — consider adding authentication or firewall rules in production
- The Beacon API (5052) is localhost-only
- Never expose the authrpc port (8551) publicly

## License

MIT

## Contributing

PRs welcome! Please open an issue first for major changes.
