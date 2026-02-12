# Coding Conventions

**Analysis Date:** 2026-02-12

## Naming Patterns

**Files:**

- TypeScript source: `kebab-case.ts` / `kebab-case.tsx` (e.g., `container-card.tsx`, `safe-action.ts`)
- Test files: `{name}.test.ts` in a separate `tests/` directory (e.g., `tests/proxmox/client.test.ts`)
- Schemas: `schemas.ts` inside domain directories (e.g., `lib/containers/schemas.ts`, `lib/templates/schemas.ts`)
- Actions: `actions.ts` inside domain directories (e.g., `lib/containers/actions.ts`, `lib/templates/actions.ts`)
- Shell scripts: `kebab-case.sh` (e.g., `config-sync.sh`, `config-manager-helpers.sh`)
- BATS tests: `test-{name}.bats` (e.g., `test-helpers.bats`, `test-config-sync.bats`)

**Functions:**

- Use `camelCase` for all TypeScript functions: `formatBytes`, `isNetworkError`, `getContainerContext`
- React components: `PascalCase` function names: `ContainerCard`, `StatusBadge`, `ContainerActions`
- Server actions: `camelCase` with `Action` suffix: `startContainerAction`, `deleteTemplateAction`
- Shell functions: `snake_case`: `detect_container_os`, `log_info`, `setup_mock_repo`

**Variables:**

- TypeScript: `camelCase` for local variables, function parameters
- Constants: `UPPER_SNAKE_CASE` for exported constants: `TASK_TIMEOUT_MS`, `DEFAULT_PVE_PORT`, `SESSION_PREFIX`
- React state: `camelCase` with `is`/`has` prefix for booleans: `isPending`, `isRefreshing`, `isPaused`
- Shell: `UPPER_SNAKE_CASE` for constants and exported vars: `REPO_DIR`, `CONFIG_FILE`, `LOG_DIR`

**Types:**

- TypeScript interfaces/types: `PascalCase`: `WizardData`, `ContainerWithStatus`, `ProxmoxClientConfig`
- Prisma enums: `PascalCase`: `ContainerLifecycle`, `ServiceType`, `EventType`
- Zod schemas: `camelCase` with `Schema` suffix: `containerConfigSchema`, `templateFormSchema`
- Inferred types from Zod: `PascalCase` matching the schema: `ContainerConfig`, `CreateContainerInput`

## Code Style

**Formatting:**

- Prettier (v3.8.1) configured at root `.prettierrc`
- Key settings: `semi: true`, `singleQuote: false`, `tabWidth: 2`, `trailingComma: "all"`, `printWidth: 80`
- Run with: `pnpm format` (write) or `pnpm format:check` (CI check)
- Prettier ignores: `node_modules`, `.next`, `.source`, `pnpm-lock.yaml`, `**/generated`

**Linting:**

- ESLint 9 flat config at `apps/dashboard/eslint.config.mjs` and `apps/web/eslint.config.mjs`
- Dashboard: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` + `eslint-config-prettier`
- Web: `eslint-config-next/core-web-vitals` + `eslint-config-prettier`
- Shell scripts: ShellCheck with `-x -S warning` and exclusions for `SC1090` (dynamic sourcing) and `SC2155` (declare/assign)
- Run with: `pnpm lint` (via Turbo)

**TypeScript:**

- Strict mode enabled (`"strict": true` in `tsconfig.json`)
- Target: ES2017, Module: esnext, Module resolution: bundler
- Path alias: `@/*` maps to `./src/*`
- ESM modules: `"type": "module"` in `package.json`

## Import Organization

**Order:**

1. `"use server"` or `"use client"` directive (first line, when applicable)
2. `"server-only"` import (when required)
3. Node.js / framework imports (`next/cache`, `next/navigation`, `react`)
4. External library imports (`zod`, `sonner`, `next-safe-action/hooks`)
5. Internal `@/` path aliases — organized by layer:
   - `@/components/ui/*` (shadcn components)
   - `@/components/*` (domain components)
   - `@/lib/*` (business logic, services)
   - `@/generated/*` (Prisma client)
6. Relative imports (`./schemas`, `./discovery`)

**Path Aliases:**

- `@/*` → `./src/*` (dashboard app)
- Used consistently in all source files and test files (via vitest alias config)

## Error Handling

**Custom Error Hierarchy (Proxmox):**

- Base: `ProxmoxError` extends `Error` — includes `statusCode`, `endpoint`, `responseBody`
- `ProxmoxAuthError` extends `ProxmoxError` — 401 responses
- `ProxmoxApiError` extends `ProxmoxError` — 4xx/5xx responses
- `ProxmoxTaskError` extends `ProxmoxError` — includes `upid`, `exitStatus`, `taskLog`
- All use `Object.setPrototypeOf(this, ClassName.prototype)` for proper `instanceof` checks
- Defined in: `apps/dashboard/src/lib/proxmox/errors.ts`

**Server Action Errors:**

- `ActionError` extends `Error` — user-facing error messages thrown in server actions
- Defined in: `apps/dashboard/src/lib/safe-action.ts`
- Pattern: `throw new ActionError("VMID 600 is already in use. Pick a different ID.")`
- `handleServerError` in safe-action client classifies errors:
  - `ActionError` → pass message through to client
  - Network errors → "Unable to reach Proxmox server"
  - All other errors → generic `DEFAULT_SERVER_ERROR_MESSAGE` + `console.error` server-side

**Client-Side Error Display:**

- Use `toast.error()` from `sonner` for action failure notifications
- Pattern: `onError: ({ error }) => { toast.error("Failed to X", { description: error.serverError ?? "An unexpected error occurred" }); }`
- Form-level errors: `<Alert variant="destructive">` from shadcn
- Field-level errors: `<FormMessage>` from shadcn Form

**Network Error Classification:**

- `isNetworkError(error)` in `apps/dashboard/src/lib/utils/errors.ts`
- Checks message + cause chain for: `fetch`, `econnrefused`, `enotfound`, `etimedout`, `ehostunreach`, `cert`, `ssl`, etc.

**Retry Strategy:**

- Proxmox client retries on 5xx and network errors with exponential backoff
- Configurable: `maxRetries` (default 3), `initialDelayMs` (default 1000), `maxDelayMs` (default 10000)
- Never retries 4xx errors (client errors) or auth errors (401)

**Container Lifecycle Locking:**

- Redis-based distributed locks prevent concurrent lifecycle actions on the same container
- Pattern: acquire lock → try/finally → release lock
- Constants: `CONTAINER_LOCK_PREFIX`, `CONTAINER_LOCK_TTL` (300s) in `lib/constants/infrastructure.ts`

## Logging

**Framework:** `console` (no structured logging framework)

**Patterns:**

- Server actions: `console.error("[safe-action] Unhandled server error:", error)` for unexpected errors
- Worker/background: `console.error("Failed to fetch Proxmox data for wizard:", error)`
- Shell scripts: Custom `log_info()`, `log_warn()`, `log_error()` functions with color-coded `[INFO]`/`[WARN]`/`[ERROR]` prefixes

## Comments

**When to Comment:**

- Module-level JSDoc: Every `lib/` module has a descriptive block comment at top explaining purpose
- Function-level JSDoc: All exported functions and class methods have `/** */` doc comments
- Inline comments: Used for non-obvious logic (e.g., "Order matters due to foreign key constraints")
- Section separators: `// ============================================================================` used to group related code

**`server-only` Documentation:**

- Files that MUST NOT have `server-only` include: `// No "server-only" — used by worker process`
- Files that SHOULD have `server-only` import it as: `import "server-only";`

**JSDoc Style:**

```typescript
/**
 * Format a memory value in MB to a human-readable string.
 * Returns "GB" for values >= 1024 MB.
 */
export function formatMemory(mb: number | null, showBoth = false): string {
```

## Function Design

**Size:** Functions are focused — typically 10-40 lines. Large server actions use helper functions.

**Parameters:** Use object parameters for 3+ args. Optional parameters use `?` or defaults.

**Return Values:**

- Server actions return `{ success: true as const }` or `{ containerId: string }` objects
- Database service methods return typed Prisma results or `null` for not-found
- Void for delete/update operations

## Module Design

**Exports:**

- Named exports only (no default exports except for Next.js pages/layouts/configs)
- Barrel files used sparingly: `lib/proxmox/index.ts` re-exports commonly used items

**`server-only` Policy:**

- Add `import "server-only"` to any module using Node.js-only APIs imported by Next.js
- MUST have: `lib/safe-action.ts`, `lib/session.ts`, `lib/templates/discovery.ts`, `lib/templates/parser.ts`
- MUST NOT have (worker needs them): `lib/db.ts`, `lib/encryption.ts`, `lib/redis.ts`, `lib/ssh.ts`, `lib/proxmox/*`
- MUST NOT have (client needs them): `lib/*/schemas.ts`, `lib/utils.ts`, `lib/utils/*`

## Component Design (shadcn-first)

**Rule:** Always use shadcn/ui components before building custom. Check the [shadcn/ui registry](https://ui.shadcn.com/docs/components) first.

**Form Pattern:**

- Use shadcn `Form` (react-hook-form) with `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`
- Validation via `zodResolver` with shared Zod schemas from `lib/*/schemas.ts`
- Execution via `useAction()` from `next-safe-action/hooks`
- Never use raw `<form>` + `useActionState`

**Server Action Pattern:**

```typescript
// Definition in lib/*/actions.ts
export const createFooAction = authActionClient
  .schema(fooSchema)
  .action(async ({ parsedInput }) => {
    // ... business logic
    revalidatePath("/foos");
    return { fooId: foo.id };
  });

// Usage in client component
const { execute, isPending } = useAction(createFooAction, {
  onSuccess: ({ data }) => {
    toast.success("Created!");
    router.push(`/foos/${data?.fooId}`);
  },
  onError: ({ error }) => {
    toast.error("Failed", { description: error.serverError });
  },
});
```

## Constants Organization

**Location:** `apps/dashboard/src/lib/constants/`

| File                | Purpose                              | Examples                                                                      |
| ------------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| `infrastructure.ts` | Ports, paths, prefixes, queue names  | `DEFAULT_PVE_PORT`, `CREDENTIALS_DIR`, `CONTAINER_CREATION_QUEUE`             |
| `timeouts.ts`       | Timing: timeouts, intervals, retries | `TASK_TIMEOUT_MS`, `TASK_POLL_INTERVAL_MS`, `AUTO_REFRESH_INTERVAL_S`         |
| `display.ts`        | UI config: status colors, thresholds | `containerStatusConfig`, `serviceStatusConfig`, `RESOURCE_CRITICAL_THRESHOLD` |

**Rules:**

- Used in 2+ files → extract to `lib/constants/`
- Timeouts/intervals → `timeouts.ts`
- Ports/paths/prefixes → `infrastructure.ts`
- UI color maps/thresholds → `display.ts`
- Never hardcode magic numbers in multiple files

## Utility Function Organization

**Location:** `apps/dashboard/src/lib/utils/`

| File            | Purpose                  | Examples                                                                         |
| --------------- | ------------------------ | -------------------------------------------------------------------------------- |
| `format.ts`     | Display formatting       | `formatBytes`, `formatUptime`, `formatRelativeTime`, `formatMemory`, `parseTags` |
| `crypto.ts`     | Client-side cryptography | `generatePassword`                                                               |
| `parse.ts`      | Generic string parsing   | `parseKeyValueString`                                                            |
| `errors.ts`     | Error classification     | `isNetworkError`                                                                 |
| `validation.ts` | Input sanitization       | `isSafeShellArg`                                                                 |
| `redis-lock.ts` | Distributed locking      | `acquireLock`, `releaseLock`                                                     |
| `packages.ts`   | Package display helpers  | `managerLabels`, `groupByManager`                                                |

**Decision rule:** Generic/reusable → `lib/utils/{category}.ts`. Domain-specific → `lib/{domain}/`.

## Database Access Pattern

**Service layer:** `DatabaseService` static class in `apps/dashboard/src/lib/db.ts`

- All DB operations go through static methods on this class
- Returns typed Prisma results (with custom type aliases like `TemplateWithCounts`, `ContainerWithRelations`)
- Uses Prisma transactions for multi-step mutations (`$transaction`)
- Hot-reload safe: uses `globalThis` singleton pattern for PrismaClient + pg Pool

**Zod Schema Sharing:**

- Schemas defined in `lib/*/schemas.ts` are shared between:
  - Server actions (validation via `authActionClient.schema()`)
  - Client forms (validation via `zodResolver()` from `@hookform/resolvers`)
- Server action input schemas use `z.coerce.number()` for string→number coercion
- Client form schemas use `z.number()` directly (react-hook-form provides numbers)

---

_Convention analysis: 2026-02-12_
