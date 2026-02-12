# Codebase Structure

**Analysis Date:** 2026-02-12

## Directory Layout

```
infrahaus/
├── apps/
│   ├── dashboard/              # Proxmox management dashboard (Next.js 16 + Prisma)
│   │   ├── prisma/             # Database schema and migrations
│   │   │   ├── schema.prisma   # Prisma schema (PostgreSQL)
│   │   │   └── migrations/     # SQL migration files
│   │   ├── src/
│   │   │   ├── app/            # Next.js App Router pages + API routes
│   │   │   │   ├── (dashboard)/    # Dashboard route group (sidebar layout)
│   │   │   │   │   ├── page.tsx            # Dashboard home (container grid)
│   │   │   │   │   ├── layout.tsx          # Sidebar shell layout
│   │   │   │   │   ├── containers/         # Container pages
│   │   │   │   │   │   ├── page.tsx        # Container list (redirects to /)
│   │   │   │   │   │   ├── new/            # Container creation wizard
│   │   │   │   │   │   └── [id]/           # Container detail + progress
│   │   │   │   │   └── templates/          # Template CRUD pages
│   │   │   │   │       ├── page.tsx        # Template list
│   │   │   │   │       ├── new/            # Create template
│   │   │   │   │       ├── [id]/           # Template detail + edit
│   │   │   │   │       └── packages/       # Package bucket management
│   │   │   │   ├── api/                    # API route handlers
│   │   │   │   │   └── containers/[id]/    # Container-specific endpoints
│   │   │   │   │       ├── progress/route.ts   # SSE progress streaming
│   │   │   │   │       └── services/route.ts   # Service discovery results
│   │   │   │   └── login/              # Login page (currently redirected)
│   │   │   ├── components/             # React components
│   │   │   │   ├── ui/                 # shadcn/ui primitives
│   │   │   │   ├── containers/         # Container-specific components
│   │   │   │   │   ├── detail/         # Container detail page tabs
│   │   │   │   │   ├── container-card.tsx
│   │   │   │   │   ├── container-grid.tsx
│   │   │   │   │   ├── container-actions.tsx
│   │   │   │   │   ├── summary-bar.tsx
│   │   │   │   │   └── status-badge.tsx
│   │   │   │   ├── templates/          # Template-specific components
│   │   │   │   │   ├── template-form.tsx
│   │   │   │   │   ├── template-card.tsx
│   │   │   │   │   ├── template-*-tab.tsx  # Tab components
│   │   │   │   │   └── script-editor.tsx
│   │   │   │   ├── packages/           # Package bucket components
│   │   │   │   └── app-sidebar.tsx     # Main sidebar navigation
│   │   │   ├── generated/              # Auto-generated (Prisma client)
│   │   │   ├── hooks/                  # Custom React hooks
│   │   │   │   ├── use-container-progress.ts   # SSE progress hook
│   │   │   │   └── use-mobile.ts               # Responsive helper
│   │   │   └── lib/                    # Core business logic
│   │   │       ├── auth/               # Auth actions (login/logout)
│   │   │       ├── constants/          # Shared constants
│   │   │       │   ├── infrastructure.ts   # Ports, paths, prefixes
│   │   │       │   ├── timeouts.ts         # Timing values
│   │   │       │   └── display.ts          # UI config (colors, thresholds)
│   │   │       ├── containers/         # Container domain
│   │   │       │   ├── actions.ts      # Server actions (create, lifecycle)
│   │   │       │   ├── data.ts         # Data fetching (DB + Proxmox merge)
│   │   │       │   ├── helpers.ts      # Domain helpers
│   │   │       │   ├── monitoring.ts   # SSH-based service monitoring
│   │   │       │   └── schemas.ts      # Zod input schemas
│   │   │       ├── packages/           # Package domain
│   │   │       │   ├── actions.ts      # Server actions (bucket CRUD)
│   │   │       │   └── schemas.ts      # Zod schemas
│   │   │       ├── proxmox/            # Proxmox VE API client
│   │   │       │   ├── index.ts        # Re-exports + factory functions
│   │   │       │   ├── client.ts       # HTTP client class
│   │   │       │   ├── auth.ts         # Authentication (login)
│   │   │       │   ├── containers.ts   # Container API operations
│   │   │       │   ├── nodes.ts        # Node API operations
│   │   │       │   ├── tasks.ts        # Task polling
│   │   │       │   ├── storage.ts      # Storage API operations
│   │   │       │   ├── templates.ts    # OS template operations
│   │   │       │   ├── schemas.ts      # Zod response schemas
│   │   │       │   ├── types.ts        # TypeScript type definitions
│   │   │       │   ├── errors.ts       # Error class hierarchy
│   │   │       │   └── utils.ts        # IP extraction helpers
│   │   │       ├── queue/              # BullMQ job queue
│   │   │       │   └── container-creation.ts   # Queue, types, helpers
│   │   │       ├── templates/          # Template domain
│   │   │       │   ├── actions.ts      # Server actions (discover, CRUD)
│   │   │       │   ├── discovery.ts    # Filesystem scanner
│   │   │       │   ├── parser.ts       # Shell script/config parser
│   │   │       │   └── schemas.ts      # Zod schemas
│   │   │       ├── utils/              # Generic utilities
│   │   │       │   ├── format.ts       # Display formatting
│   │   │       │   ├── parse.ts        # String parsing
│   │   │       │   ├── errors.ts       # Error classification
│   │   │       │   ├── validation.ts   # Input sanitization
│   │   │       │   ├── crypto.ts       # Password generation
│   │   │       │   ├── redis-lock.ts   # Distributed locking
│   │   │       │   └── packages.ts     # Package display helpers
│   │   │       ├── db.ts              # DatabaseService + Prisma instance
│   │   │       ├── redis.ts           # Redis connection (ioredis)
│   │   │       ├── session.ts         # Session management (iron-session + Redis)
│   │   │       ├── safe-action.ts     # next-safe-action client factory
│   │   │       ├── ssh.ts             # SSH/PctExec session classes
│   │   │       ├── encryption.ts      # AES-256-GCM encrypt/decrypt
│   │   │       └── utils.ts           # Tailwind cn() helper
│   │   ├── workers/
│   │   │   └── container-creation.ts   # BullMQ worker process
│   │   ├── tests/                      # Vitest test files
│   │   ├── public/                     # Static assets
│   │   ├── docker-compose.dev.yaml     # Dev PostgreSQL + Redis
│   │   └── package.json
│   └── web/                    # Documentation site (Next.js 15 + Fumadocs)
│       ├── app/                # Next.js App Router
│       │   ├── (home)/         # Home page route group
│       │   ├── docs/           # Documentation pages
│       │   └── api/search/     # Search API endpoint
│       ├── content/docs/       # MDX documentation content
│       │   ├── ai/             # AI/ML service docs
│       │   ├── blockchain/     # Blockchain node docs
│       │   ├── container-templates/
│       │   ├── deployment/
│       │   ├── development/
│       │   ├── gaming/
│       │   ├── getting-started/
│       │   ├── media/
│       │   └── networking/
│       ├── lib/                # Fumadocs source config
│       └── package.json
├── infra/                      # Infrastructure-as-code
│   ├── ai/                     # AI services (Ollama, Open WebUI, Kokoro TTS, ComfyUI)
│   ├── coder/                  # Coder workspace template (Terraform)
│   ├── docker/                 # Docker installation docs
│   ├── dokploy/                # Dokploy PaaS setup
│   ├── gaming/                 # Sunshine + Steam gaming
│   ├── jellyfin/               # Jellyfin media server
│   ├── lukso-node/             # LUKSO blockchain node (Geth + Lighthouse)
│   ├── lxc/                    # LXC container management
│   │   ├── scripts/            # Config-manager shell scripts
│   │   │   └── config-manager/ # Core config-manager modules
│   │   │       └── package-handlers/   # Per-package-manager handlers
│   │   ├── templates/          # LXC container templates
│   │   │   └── web3-dev/       # Web3 development template
│   │   │       └── container-configs/
│   │   │           ├── scripts/    # Numbered setup scripts
│   │   │           ├── files/      # Config files to deploy
│   │   │           └── packages/   # Package list files
│   │   ├── tests/              # Bats test suite for config-manager
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   ├── lint/
│   │   │   └── fixtures/
│   │   └── docs/               # LXC documentation
│   └── wireguard/              # WireGuard VPN setup
├── bin/                        # Project-level scripts (currently empty)
├── .github/workflows/          # CI/CD (lint, format, build)
├── package.json                # Root workspace config
├── pnpm-workspace.yaml         # Workspace: apps/* + packages/*
├── turbo.json                  # Turborepo pipeline (build, dev, lint)
├── Dockerfile                  # Multi-stage build for web app
├── docker-compose.yml          # Production compose for web app
├── .prettierrc                 # Prettier config
└── .gitignore
```

## Directory Purposes

**`apps/dashboard/src/app/`:**

- Purpose: Next.js App Router routes for the management dashboard
- Contains: RSC pages, layouts, loading states, API route handlers
- Key files: `(dashboard)/page.tsx` (main dashboard), `(dashboard)/layout.tsx` (sidebar shell)
- Route groups: `(dashboard)` for sidebar layout, `login` for auth (currently disabled)

**`apps/dashboard/src/components/`:**

- Purpose: Reusable React components organized by domain
- Contains: Domain components (`containers/`, `templates/`, `packages/`), shadcn/ui primitives (`ui/`)
- Key files: `app-sidebar.tsx` (navigation), `containers/container-grid.tsx` (dashboard grid)

**`apps/dashboard/src/lib/`:**

- Purpose: Core business logic, shared across pages, actions, and worker
- Contains: Domain modules, infrastructure clients, utilities, constants
- Key files: `db.ts` (DatabaseService), `safe-action.ts` (action factory), `proxmox/index.ts` (API client)

**`apps/dashboard/src/lib/proxmox/`:**

- Purpose: Full Proxmox VE API client with typed operations
- Contains: HTTP client, domain-specific API modules, Zod schemas for response validation
- Key files: `client.ts` (ProxmoxClient class), `index.ts` (factory functions + re-exports)

**`apps/dashboard/src/lib/containers/`:**

- Purpose: Container domain logic — CRUD actions, data fetching, monitoring
- Contains: Server actions, data layer (DB + Proxmox merge), SSH-based monitoring engine
- Key files: `actions.ts` (all container server actions), `data.ts` (dashboard/detail data)

**`apps/dashboard/src/workers/`:**

- Purpose: Standalone background worker processes
- Contains: BullMQ worker for container creation pipeline
- Key files: `container-creation.ts` (5-phase pipeline, runs via `tsx --watch`)

**`apps/dashboard/prisma/`:**

- Purpose: Database schema definition and migrations
- Contains: `schema.prisma`, migration SQL files
- Key files: `schema.prisma` (10 models: ProxmoxNode, Template, Container, etc.)

**`apps/web/content/docs/`:**

- Purpose: MDX documentation content for the Fumadocs site
- Contains: Organized by service category (ai, blockchain, gaming, etc.)

**`infra/`:**

- Purpose: Infrastructure configurations for all home lab services
- Contains: Per-service directories with Docker Compose files, setup scripts, config files
- Key subdirs: `lxc/` (config-manager + templates, tested with Bats), `coder/` (Terraform template)

**`infra/lxc/`:**

- Purpose: LXC container management framework — config-manager + templates
- Contains: Shell-based config-manager, per-template configurations, Bats test suite
- Key files: `scripts/config-manager/` (core framework), `templates/web3-dev/` (reference template)
- Note: Dashboard's template discovery engine scans `infra/lxc/templates/` for filesystem-sourced templates

## Key File Locations

**Entry Points:**

- `apps/dashboard/src/app/(dashboard)/page.tsx`: Dashboard home page (container grid + summary)
- `apps/dashboard/src/workers/container-creation.ts`: Background worker entry point
- `apps/web/app/(home)/page.tsx`: Documentation site home page
- `apps/dashboard/src/middleware.ts`: Next.js middleware (route protection)

**Configuration:**

- `apps/dashboard/prisma/schema.prisma`: Database schema (PostgreSQL)
- `apps/dashboard/docker-compose.dev.yaml`: Dev PostgreSQL + Redis
- `turbo.json`: Turborepo task pipeline
- `pnpm-workspace.yaml`: Workspace definition (`apps/*`, `packages/*`)
- `.prettierrc`: Code formatting config
- `.github/workflows/ci.yml`: CI pipeline (lint → format → build)

**Core Logic:**

- `apps/dashboard/src/lib/db.ts`: DatabaseService (all Prisma operations)
- `apps/dashboard/src/lib/proxmox/client.ts`: Proxmox HTTP client
- `apps/dashboard/src/lib/proxmox/index.ts`: Client factories + barrel exports
- `apps/dashboard/src/lib/containers/actions.ts`: Container server actions (960 lines — largest action file)
- `apps/dashboard/src/lib/containers/data.ts`: Data fetch + merge layer
- `apps/dashboard/src/lib/containers/monitoring.ts`: SSH-based monitoring engine
- `apps/dashboard/src/lib/safe-action.ts`: Server action client factory
- `apps/dashboard/src/lib/session.ts`: Session management (iron-session + Redis)
- `apps/dashboard/src/lib/ssh.ts`: SSH session classes
- `apps/dashboard/src/lib/encryption.ts`: AES-256-GCM encryption
- `apps/dashboard/src/lib/queue/container-creation.ts`: BullMQ queue definition + progress types

**Testing:**

- `apps/dashboard/tests/`: Vitest test files
- `infra/lxc/tests/`: Bats test suite for config-manager shell scripts

## Naming Conventions

**Files:**

- `kebab-case.ts` / `kebab-case.tsx` for all source files
- `page.tsx`, `layout.tsx`, `loading.tsx`, `route.ts` for Next.js conventions
- `actions.ts` for server action files (always `"use server"` directive)
- `schemas.ts` for Zod schema files (shared between server/client)

**Directories:**

- `kebab-case` for all directories
- `[param]` for Next.js dynamic routes (e.g., `[id]`)
- `(group)` for Next.js route groups (e.g., `(dashboard)`)
- Domain-grouped: `lib/{domain}/` (containers, templates, packages, proxmox)

**Components:**

- PascalCase for component names, kebab-case for filenames
- Example: `ContainerGrid` in `container-grid.tsx`
- Domain prefix: `container-*.tsx`, `template-*.tsx`

**Exports:**

- Named exports for all functions and components (no default exports except pages)
- Barrel files: `proxmox/index.ts` re-exports all modules
- No barrel files for other domains — import from specific files

## Where to Add New Code

**New Dashboard Page:**

- Route: `apps/dashboard/src/app/(dashboard)/{route}/page.tsx`
- Layout (if needed): `apps/dashboard/src/app/(dashboard)/{route}/layout.tsx`
- Loading state: `apps/dashboard/src/app/(dashboard)/{route}/loading.tsx`

**New Server Action:**

- File: `apps/dashboard/src/lib/{domain}/actions.ts` (add to existing file or create new)
- Schema: `apps/dashboard/src/lib/{domain}/schemas.ts`
- Pattern: `export const myAction = authActionClient.schema(mySchema).action(async ({ parsedInput }) => { ... })`

**New React Component:**

- Domain component: `apps/dashboard/src/components/{domain}/{component-name}.tsx`
- UI primitive: Install via `npx shadcn@latest add {component}` → `apps/dashboard/src/components/ui/`
- Client component: Add `"use client"` directive at top

**New Proxmox API Operation:**

- Add to existing module: `apps/dashboard/src/lib/proxmox/{domain}.ts`
- Add Zod schema: `apps/dashboard/src/lib/proxmox/schemas.ts`
- Add TypeScript type: `apps/dashboard/src/lib/proxmox/types.ts`

**New Database Operation:**

- Add static method to `DatabaseService` in `apps/dashboard/src/lib/db.ts`
- Schema change: Edit `apps/dashboard/prisma/schema.prisma`, run `npx prisma migrate dev`

**New API Route:**

- File: `apps/dashboard/src/app/api/{path}/route.ts`
- Pattern: `export async function GET/POST(request: NextRequest) { ... }`

**New Custom Hook:**

- File: `apps/dashboard/src/hooks/use-{name}.ts`
- Add `"use client"` directive

**New Utility Function:**

- Generic (reusable): `apps/dashboard/src/lib/utils/{category}.ts`
- Domain-specific: `apps/dashboard/src/lib/{domain}/helpers.ts` or inline in domain module

**New Constant:**

- Timeout/interval: `apps/dashboard/src/lib/constants/timeouts.ts`
- Port/path/prefix: `apps/dashboard/src/lib/constants/infrastructure.ts`
- UI config: `apps/dashboard/src/lib/constants/display.ts`

**New Infrastructure Service:**

- Directory: `infra/{service-name}/`
- Docker Compose: `infra/{service-name}/docker-compose.yaml`
- Documentation: `apps/web/content/docs/{category}/{service}.mdx`

**New LXC Template:**

- Directory: `infra/lxc/templates/{template-name}/`
- Entry script: `infra/lxc/templates/{template-name}/container.sh`
- Config files: `infra/lxc/templates/{template-name}/container-configs/`

## Special Directories

**`apps/dashboard/src/generated/`:**

- Purpose: Auto-generated Prisma client code
- Generated: Yes (via `prisma generate`)
- Committed: Yes (output configured to `src/generated/prisma/client`)

**`apps/dashboard/.next/`:**

- Purpose: Next.js build output and dev cache
- Generated: Yes
- Committed: No (in .gitignore)

**`apps/web/.source/`:**

- Purpose: Fumadocs generated source metadata
- Generated: Yes (by fumadocs-mdx)
- Committed: Yes

**`node_modules/`:**

- Purpose: Installed dependencies (root + workspace hoisting)
- Generated: Yes
- Committed: No

**`.turbo/`:**

- Purpose: Turborepo cache
- Generated: Yes
- Committed: No

**`.planning/`:**

- Purpose: Project planning and codebase analysis documents
- Generated: By analysis tools
- Committed: Yes

**`bin/`:**

- Purpose: Project-level scripts and binaries
- Generated: No
- Committed: Yes (currently empty)

---

_Structure analysis: 2026-02-12_
