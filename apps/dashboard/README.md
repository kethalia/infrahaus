# Dashboard

LXC Template Manager Dashboard for Proxmox VE.

## Development

```bash
# Start dev services (PostgreSQL + Redis)
docker compose -f docker-compose.dev.yaml up -d

# Run the app
pnpm dev
```

The dashboard runs at [http://localhost:3001](http://localhost:3001).
