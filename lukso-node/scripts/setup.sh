#!/bin/bash
# Initial setup script for LUKSO node

set -e

echo "🔷 LUKSO Docker Node Setup"
echo ""

# Check for .env
if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
  echo "⚠️  Please edit .env and set GRAFANA_ADMIN_PASSWORD"
  echo ""
fi

# Load config
export $(grep -v '^#' .env | xargs)
DATA_DIR="${DATA_DIR:-/mnt/lukso-node}"

echo "Data directory: $DATA_DIR"
echo ""

# Create directories
echo "Creating data directories..."
sudo mkdir -p "$DATA_DIR"/{geth,lighthouse,configs}

# Check for network configs
if [ ! -f "$DATA_DIR/configs/genesis.json" ]; then
  echo ""
  echo "⚠️  Network configuration files not found!"
  echo ""
  read -p "Download official LUKSO mainnet configs? (Y/n) " -n 1 -r
  echo
  
  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo "Downloading network configs..."
    TEMP_DIR=$(mktemp -d)
    git clone --depth 1 https://github.com/lukso-network/network-configs.git "$TEMP_DIR/network-configs"
    sudo cp -r "$TEMP_DIR/network-configs/mainnet/shared/"* "$DATA_DIR/configs/"
    rm -rf "$TEMP_DIR"
    echo "✅ Network configs installed"
  fi
fi

# Check for JWT
if [ ! -f "$DATA_DIR/configs/jwt.hex" ]; then
  echo "Generating JWT secret..."
  openssl rand -hex 32 | sudo tee "$DATA_DIR/configs/jwt.hex" > /dev/null
  echo "✅ JWT secret generated"
fi

# Make scripts executable
chmod +x scripts/*.sh

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Edit .env and set GRAFANA_ADMIN_PASSWORD"
echo "  2. Start the node: docker compose up -d"
echo "  3. Check status: ./scripts/status.sh"
echo "  4. View logs: docker compose logs -f"
echo "  5. Open Grafana: http://localhost:${GRAFANA_PORT:-3000}"
