# Testing Patterns

**Analysis Date:** 2026-02-12

## Test Framework

**Dashboard (TypeScript):**

- Runner: Vitest 4.x
- Config: `apps/dashboard/vitest.config.ts`
- Assertion: Vitest built-in (`expect`, `describe`, `it`)
- UI mode: `@vitest/ui` for browser-based test runner
- Environment: Node (not jsdom — no browser DOM tests)

**Infrastructure (Bash):**

- Runner: BATS (Bash Automated Testing System)
- Helpers: `bats-support` + `bats-assert` libraries
- Coverage: `kcov` for bash line coverage
- Lint: ShellCheck with `-x -S warning`

**Run Commands:**

```bash
# Dashboard TypeScript tests
pnpm test                    # Run all tests (vitest run)
pnpm test:watch              # Watch mode (vitest)
pnpm test:ui                 # Browser UI (vitest --ui)

# Infrastructure Bash tests (via Docker)
infra/lxc/tests/run-tests.sh              # Run all (lint + unit + integration)
infra/lxc/tests/run-tests.sh lint         # ShellCheck only
infra/lxc/tests/run-tests.sh unit         # BATS unit tests only
infra/lxc/tests/run-tests.sh integration  # BATS integration tests only
infra/lxc/tests/run-tests.sh coverage     # Unit tests with kcov coverage
```

## Test File Organization

**Dashboard — Separate test directory:**

```
apps/dashboard/
├── tests/
│   ├── setup.ts                    # Global test setup (DB connection, cleanup)
│   ├── __mocks__/
│   │   └── server-only.ts          # Mock for server-only package
│   ├── schema.test.ts              # Database schema relation tests
│   └── proxmox/
│       ├── auth.test.ts            # Proxmox auth module tests
│       ├── client.test.ts          # Proxmox HTTP client tests
│       ├── containers.test.ts      # Proxmox container API tests
│       └── tasks.test.ts           # Proxmox task polling tests
├── vitest.config.ts                # Vitest configuration
└── src/                            # Source code (no co-located tests)
```

**Infrastructure — Separate test directory with fixtures:**

```
infra/lxc/tests/
├── bats-helpers.bash               # Shared BATS helper functions
├── run-tests.sh                    # Test runner (Docker-based)
├── run-coverage.sh                 # Coverage runner (kcov)
├── docker-compose.yml              # Docker services for test environments
├── Dockerfile.unit                 # Container for unit tests
├── Dockerfile.integration          # Container for integration tests (systemd)
├── fixtures/
│   ├── config.env                  # Test config fixture
│   ├── os-release                  # Mock /etc/os-release
│   └── mock-repo/                  # Full mock repo structure
│       └── infra/lxc/...
├── unit/
│   ├── test-helpers.bats
│   ├── test-config-sync.bats
│   ├── test-execute-scripts.bats
│   ├── test-process-files.bats
│   └── test-package-handlers.bats
├── integration/
│   ├── test-service-permissions.bats
│   └── test-user-setup.bats
└── lint/
    └── test-shellcheck.bats
```

**Naming:**

- TypeScript: `{name}.test.ts` (e.g., `client.test.ts`, `schema.test.ts`)
- BATS: `test-{name}.bats` (e.g., `test-helpers.bats`, `test-config-sync.bats`)

## Vitest Configuration

```typescript
// apps/dashboard/vitest.config.ts
export default defineConfig({
  test: {
    globals: true, // describe/it/expect available without import
    environment: "node", // Node environment (no jsdom)
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
    },
    alias: {
      // Mock server-only package (throws in real client code)
      "server-only": resolve(__dirname, "./tests/__mocks__/server-only.ts"),
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"), // Match tsconfig path alias
    },
  },
});
```

## Test Structure (TypeScript)

**Suite Organization:**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProxmoxClient } from "@/lib/proxmox/client";
import type { ProxmoxApiTokenCredentials } from "@/lib/proxmox/types";

describe("ProxmoxClient", () => {
  const mockCredentials: ProxmoxApiTokenCredentials = {
    type: "token",
    tokenId: "root@pam!test",
    tokenSecret: "secret",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("should create client with default port 8006", () => {
      const client = new ProxmoxClient({
        host: "pve.example.com",
        credentials: mockCredentials,
      });
      expect(client).toBeInstanceOf(ProxmoxClient);
    });
  });

  describe("error handling", () => {
    it("should throw ProxmoxAuthError on 401", async () => {
      // ...setup mock...
      await expect(client.get("/test")).rejects.toThrow(ProxmoxAuthError);
    });
  });
});
```

**Patterns:**

- **Setup:** `beforeEach(() => vi.clearAllMocks())` + `afterEach(() => vi.restoreAllMocks())`
- **Grouping:** Nested `describe` blocks by feature/behavior area
- **Assertions:** `expect().toBe()`, `expect().toEqual()`, `expect().toBeInstanceOf()`, `expect().rejects.toThrow()`
- **Test names:** Descriptive `it("should ...")` format

## Test Structure (BATS)

**Suite Organization:**

```bash
#!/usr/bin/env bats
# test-helpers.bats — Unit tests for config-manager-helpers.sh

load '../bats-helpers'

setup() {
    # Provide logging stubs
    log_info()  { echo "[INFO] $*"; }
    log_warn()  { echo "[WARN] $*"; }
    log_error() { echo "[ERROR] $*"; }
    export -f log_info log_warn log_error

    # Re-source the script under test
    unset _CONFIG_MANAGER_HELPERS_LOADED
    source "${CM_SCRIPTS}/config-manager-helpers.sh"
}

@test "detect_container_os: detects debian from /etc/os-release" {
    detect_container_os
    assert_equal "$CONTAINER_OS" "debian"
    [[ "$CONTAINER_OS_VERSION" == "12" ]]
}

@test "is_installed: returns 0 for bash" {
    run is_installed bash
    assert_success
}

@test "is_installed: returns 1 for nonexistent command" {
    run is_installed this_command_does_not_exist_xyz
    assert_failure
}
```

**Patterns:**

- `load '../bats-helpers'` loads shared setup (paths, helper functions)
- `setup()` / `teardown()` for per-test lifecycle
- `@test "function_name: descriptive behavior" { ... }` naming convention
- `run <command>` captures output + exit code
- `assert_success`, `assert_failure`, `assert_output --partial "..."`, `assert_equal` from bats-assert

## Mocking (TypeScript)

**Framework:** Vitest built-in (`vi.fn()`, `vi.mock()`, `vi.stubGlobal()`)

**Global Fetch Mocking:**

```typescript
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: { vmid: 100, name: "test-ct" } }),
});
vi.stubGlobal("fetch", mockFetch);
```

**Sequential Response Mocking:**

```typescript
const mockFetch = vi
  .fn()
  .mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: runningStatus }),
  })
  .mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: completedStatus }),
  });
vi.stubGlobal("fetch", mockFetch);
```

**Error Response Mocking:**

```typescript
const mockFetch = vi.fn().mockResolvedValue({
  ok: false,
  status: 401,
  statusText: "Unauthorized",
  text: async () => JSON.stringify({ errors: { auth: "Invalid token" } }),
});
vi.stubGlobal("fetch", mockFetch);
```

**Network Error Mocking:**

```typescript
const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
vi.stubGlobal("fetch", mockFetch);
```

**server-only Module Mock:**

```typescript
// tests/__mocks__/server-only.ts
export {};
```

Configured in vitest.config.ts alias to replace the real `server-only` package (which throws at import time in non-server contexts).

**What to Mock:**

- Global `fetch` for all Proxmox API tests (no real HTTP calls)
- `server-only` package import (would throw in test environment)
- External services (Proxmox API, SSH connections)

**What NOT to Mock:**

- Prisma database operations — schema tests use a real `_test` database
- Zod schema validation
- Internal business logic / pure functions

## Mocking (BATS)

**Pattern:** Function stubs via `export -f`

```bash
setup() {
    log_info()  { echo "[INFO] $*"; }
    log_warn()  { echo "[WARN] $*"; }
    log_error() { echo "[ERROR] $*"; }
    export -f log_info log_warn log_error
}
```

**Mock filesystem:** Fixtures in `tests/fixtures/mock-repo/` replicate the repo directory structure for testing config-manager scripts.

## Fixtures and Factories

**Test Data (TypeScript):**

```typescript
// Inline mock objects — no factory library
const mockTicketCredentials: ProxmoxTicketCredentials = {
  type: "ticket",
  ticket: "test-ticket",
  csrfToken: "test-csrf",
  username: "root@pam",
  expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
};

const mockTokenCredentials: ProxmoxApiTokenCredentials = {
  type: "token",
  tokenId: "root@pam!test-token",
  tokenSecret: "test-secret-uuid",
};
```

**Database Test Setup:**

```typescript
// tests/setup.ts
// Uses dedicated test database (appends _test suffix to DATABASE_URL)
const testDatabaseUrl = getTestDatabaseUrl();
const pool = new Pool({ connectionString: testDatabaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

beforeAll(async () => {
  await prisma.$connect();
});

beforeEach(async () => {
  // Clean all tables respecting FK order
  await prisma.containerEvent.deleteMany();
  await prisma.containerService.deleteMany();
  await prisma.container.deleteMany();
  await prisma.package.deleteMany();
  await prisma.packageBucket.deleteMany();
  await prisma.templateScript.deleteMany();
  await prisma.templateFile.deleteMany();
  await prisma.template.deleteMany();
  await prisma.proxmoxNode.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
```

**Fixture Location:**

- TypeScript: Inline in test files (no separate fixture directory)
- BATS: `infra/lxc/tests/fixtures/` — config files, mock repo structure, OS release file

## Coverage

**TypeScript (Dashboard):**

- Provider: V8
- Reporters: text, json, html
- Includes: `src/**/*.ts`
- No enforced threshold (no coverage gate in CI)
- View: `pnpm test -- --coverage`

**Bash (Infrastructure):**

- Provider: kcov
- Target: 70% (warnings below 70%, errors below 50%)
- Tracked scripts: `config-sync.sh`, `config-manager-helpers.sh`, `execute-scripts.sh`, `process-files.sh`
- View: HTML report at `infra/lxc/tests/coverage/index.html`
- CI: Coverage report uploaded as GitHub Actions artifact

## Test Types

**Unit Tests (TypeScript):**

- Scope: Individual modules/classes — ProxmoxClient, auth functions, task polling, container API wrappers
- Location: `apps/dashboard/tests/proxmox/`
- Mocking: Global fetch stubbed, no real HTTP calls
- Database: Real test database for schema relation tests (`tests/schema.test.ts`)
- Count: 4 test files, ~50 test cases

**Unit Tests (BATS):**

- Scope: Individual bash functions — helpers, config sync, script execution, file processing, package handlers
- Location: `infra/lxc/tests/unit/`
- Environment: Docker container (Dockerfile.unit) — isolated, reproducible
- Count: 5 test files

**Integration Tests (BATS):**

- Scope: End-to-end bash script behavior with real systemd
- Location: `infra/lxc/tests/integration/`
- Environment: Privileged Docker container with systemd init (Dockerfile.integration)
- Requires: `--privileged`, tmpfs mounts, cgroup access
- Count: 2 test files

**Lint Tests (BATS):**

- Scope: ShellCheck static analysis of all config-manager scripts
- Location: `infra/lxc/tests/lint/`
- Count: 1 test file

**E2E Tests:**

- Not implemented for the dashboard app (no Playwright/Cypress)

## CI Pipeline

**GitHub Actions Workflows:**

1. **CI** (`.github/workflows/ci.yml`):
   - Triggers: push/PR to `main`
   - Jobs: Lint → Format → Build (sequential)
   - Does NOT run TypeScript tests (no `pnpm test` step)
   - Node 22, pnpm (auto-detected version)

2. **Config Manager Tests** (`.github/workflows/test-config-manager.yml`):
   - Triggers: push/PR to `main` with changes in `infra/lxc/**`
   - Jobs: ShellCheck Lint → Unit Tests → Coverage (parallel) + Integration Tests
   - Uses Docker containers for isolated test environments
   - Coverage report uploaded as artifact

## Common Patterns

**Async Testing:**

```typescript
it("should unwrap successful response", async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { vmid: 100, name: "test-ct" } }),
  });
  vi.stubGlobal("fetch", mockFetch);

  const result = await client.get<{ vmid: number; name: string }>("/test");
  expect(result).toEqual({ vmid: 100, name: "test-ct" });
});
```

**Error Testing:**

```typescript
it("should throw ProxmoxAuthError on 401", async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 401,
    statusText: "Unauthorized",
    text: async () => JSON.stringify({}),
  });
  vi.stubGlobal("fetch", mockFetch);

  await expect(client.get("/test")).rejects.toThrow(ProxmoxAuthError);
});
```

**Retry Behavior Testing:**

```typescript
it("should retry on network error", async () => {
  const client = new ProxmoxClient({
    host: "pve.example.com",
    credentials: mockCredentials,
    retryConfig: { maxRetries: 2, initialDelayMs: 100, maxDelayMs: 1000 },
  });

  const mockFetch = vi
    .fn()
    .mockRejectedValueOnce(new Error("Network error"))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { success: true } }),
    });
  vi.stubGlobal("fetch", mockFetch);

  const result = await client.get("/test");
  expect(result).toEqual({ success: true });
  expect(mockFetch).toHaveBeenCalledTimes(2);
});
```

**Database Relation Testing:**

```typescript
it("should cascade delete scripts when template is deleted", async () => {
  const template = await prisma.template.create({
    data: {
      name: "Template to Delete",
      scripts: {
        create: [{ name: "script.sh", order: 0, content: "echo test" }],
      },
    },
  });

  await prisma.template.delete({ where: { id: template.id } });

  const scriptsAfter = await prisma.templateScript.count({
    where: { templateId: template.id },
  });
  expect(scriptsAfter).toBe(0);
});
```

**Skipping Tests:**

```typescript
it.skip("should handle log fetch errors gracefully", async () => {
  // Skipping this test due to mocking complexity with async polling
  // The functionality is covered by other tests
});
```

## Test Gaps

**Not Tested:**

- React components (no component tests, no rendering tests)
- Server actions (`lib/*/actions.ts`) — no integration tests
- Worker process (`src/workers/container-creation.ts`)
- SSE endpoints (`src/app/api/containers/[id]/progress/route.ts`)
- Custom hooks (`src/hooks/use-auto-refresh.ts`, `use-container-progress.ts`)
- Template discovery/parsing (`lib/templates/discovery.ts`, `lib/templates/parser.ts`)
- SSH operations (`lib/ssh.ts`)
- Container monitoring (`lib/containers/monitoring.ts`)
- Redis operations (`lib/redis.ts`, `lib/utils/redis-lock.ts`)
- Encryption utilities (`lib/encryption.ts`)

**What IS Tested:**

- Proxmox HTTP client (auth, requests, errors, retries)
- Proxmox API wrappers (containers, tasks, auth)
- Database schema relations (cascading deletes, indexes, unique constraints)
- Config-manager bash scripts (helpers, config sync, file processing, script execution, package handlers)

---

_Testing analysis: 2026-02-12_
