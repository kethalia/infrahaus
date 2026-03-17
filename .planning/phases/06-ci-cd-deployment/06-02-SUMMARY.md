---
phase: 06-ci-cd-deployment
plan: 02
subsystem: infra
tags: [docker-compose, postgres, redis, migration, deployment, env]

requires:
  - phase: 06-01
    provides: Working Dockerfile with worker-runner stage

provides:
  - Production docker-compose.yml with 5 services (postgres, redis, migrate, app, worker)
  - Startup dependency ordering via healthchecks and service_completed_successfully
  - .env.example documenting all required environment variables

affects: [06-03, deployment]

tech-stack:
  added: []
  patterns:
    - Migration service pattern: runs prisma migrate deploy then exits (service_completed_successfully)
    - No hardcoded secrets — all sensitive values use ${VAR} substitution
    - Container networking: services communicate via Docker hostnames (not localhost)

key-files:
  created:
    - .env.example
  modified:
    - docker-compose.yml

key-decisions:
  - "migrate service uses restart: no — it must exit cleanly for service_completed_successfully"
  - "app + worker both wait for migrate AND redis to be healthy before starting"
  - "DATABASE_URL uses @postgres:5432 — Docker container hostname, not localhost"
  - "REDIS_URL uses redis://redis:6379 — Docker container hostname, not localhost"
  - "worker uses target: worker-runner to select correct Dockerfile stage"

patterns-established:
  - "Migration-first deploy: separate migrate service exits 0 before app/worker start"
  - "Health-gated startup: all downstream services wait for upstream healthchecks"
---

# 06-02: Production docker-compose.yml + .env.example

## What Was Built

Replaced the skeletal single-service compose (only `web`) with a complete 5-service production stack.

## Services

| Service | Image/Target | Purpose |
|---------|-------------|---------|
| postgres | postgres:16-alpine | Primary database with healthcheck |
| redis | redis:7-alpine | Session/queue/cache with healthcheck |
| migrate | builder target | Runs prisma migrate deploy then exits |
| app | runner target (default) | Next.js production server |
| worker | worker-runner target | BullMQ container-creation worker |

## Startup Order

```
postgres (healthy) ─┐
                    ├─→ migrate (exits 0) ─┬─→ app
redis (healthy) ────┘                      └─→ worker
```

## Changes

**`docker-compose.yml`** — Full rewrite:
- 5 services with named volumes (postgres-data, redis-data)
- Healthchecks on postgres and redis
- migrate service with `restart: "no"` and `service_completed_successfully` condition
- Zero hardcoded secrets — all use `${VAR}` substitution

**`.env.example`** — Created with all 7 variables documented:
- POSTGRES_PASSWORD, DATABASE_URL, REDIS_URL
- ENCRYPTION_KEY, SESSION_SECRET
- NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID, PORT

## Verification

- 5 services present ✓
- `service_completed_successfully` appears twice (app + worker depend on migrate) ✓
- `service_healthy` conditions on postgres + redis ✓
- worker uses `target: worker-runner` ✓
- .env.example has all required vars ✓
