# Codebase Concerns

**Analysis Date:** 2026-02-12

## Tech Debt

**Env-var auth is a placeholder for real authentication:**

- Issue: The dashboard has no real user authentication. `authActionClient` in `apps/dashboard/src/lib/safe-action.ts` only checks that `PVE_HOST` and `PVE_ROOT_PASSWORD` env vars exist. Middleware at `apps/dashboard/src/middleware.ts` redirects `/login` to the dashboard, bypassing any login flow.
- Files: `apps/dashboard/src/lib/safe-action.ts`, `apps/dashboard/src/middleware.ts`, `apps/dashboard/src/lib/auth/actions.ts`
- Impact: Anyone with network access to the dashboard can perform any action including creating/destroying containers. No session management, no RBAC, no audit trail.
- Fix approach: Implement multi-user auth with DB-stored credentials (comments in code suggest this is planned). Add session management via `iron-session` + Redis (lib structure already has `lib/session.ts` reference). Add middleware that actually validates sessions.

**Container creation worker is a monolith (889 lines):**

- Issue: `apps/dashboard/src/workers/container-creation.ts` is an 889-line single file handling job processing, Proxmox API calls, SSH setup, package installation, service configuration, and progress reporting.
- Files: `apps/dashboard/src/workers/container-creation.ts`
- Impact: Difficult to test individual stages in isolation. A failure in one stage requires understanding the entire pipeline. Changes to any step risk breaking others.
- Fix approach: Extract pipeline stages into separate modules under `lib/workers/stages/` (e.g., `create-container.ts`, `configure-network.ts`, `install-packages.ts`, `setup-services.ts`). The worker file should only orchestrate the pipeline.

**Configure step component is oversized (786 lines):**

- Issue: The container creation form's configure step is a single 786-line React component.
- Files: `apps/dashboard/src/app/(dashboard)/containers/new/steps/configure-step.tsx`
- Impact: Hard to maintain, review, and test. Likely has interleaved concerns (form state, validation, UI rendering, network config).
- Fix approach: Extract sub-sections (network config, resource allocation, storage config) into focused sub-components within a `configure-step/` directory.

**Template form component is oversized (687 lines):**

- Issue: The template form is a large single-file component.
- Files: `apps/dashboard/src/components/templates/template-form.tsx`
- Impact: Same maintainability concerns as configure-step.
- Fix approach: Break into sub-components for each form section (metadata, packages, scripts, files).

**Inconsistent shell script strictness:**

- Issue: Most LXC template scripts use `set -euo pipefail` but some scripts (e.g., `52-opencode.sh`, `51-filebrowser.sh`, `50-vscode-server.sh`) use only `set -eo pipefail` (missing `-u` for undefined variable detection). Lukso node scripts use only `set -e`.
- Files: `infra/lxc/templates/web3-dev/container-configs/scripts/52-opencode.sh`, `infra/lxc/templates/web3-dev/container-configs/scripts/51-filebrowser.sh`, `infra/lxc/templates/web3-dev/container-configs/scripts/50-vscode-server.sh`, `infra/lukso-node/scripts/*.sh`
- Impact: Undefined variables silently expand to empty strings, which can cause subtle bugs in provisioning (e.g., incorrect paths, skipped conditions).
- Fix approach: Standardize all scripts to `set -euo pipefail`. Address any `${var:-default}` patterns needed to make `-u` safe.

## Security Considerations

**No authentication on dashboard:**

- Risk: All dashboard routes and server actions are accessible without authentication. Anyone on the network can create, start, stop, and destroy containers on the Proxmox host.
- Files: `apps/dashboard/src/middleware.ts`, `apps/dashboard/src/lib/safe-action.ts`
- Current mitigation: Assumes deployment on a trusted private network. Env-var auth means the server operator must configure `PVE_HOST` and `PVE_ROOT_PASSWORD`.
- Recommendations: Implement real authentication before exposing to any untrusted network. At minimum add HTTP basic auth or IP allowlisting via middleware.

**Root password used for Proxmox API access:**

- Risk: The dashboard authenticates to Proxmox using `PVE_ROOT_PASSWORD` (root account). Any action performed through the dashboard runs with full Proxmox root privileges.
- Files: `apps/dashboard/src/workers/container-creation.ts` (lines 257-261), `apps/dashboard/src/lib/safe-action.ts`
- Current mitigation: None — this is by design for the current single-user setup.
- Recommendations: Create a dedicated Proxmox API user/token with limited permissions instead of using root. Support Proxmox API tokens as an alternative to password auth.

**Hardcoded localhost references in LUKSO node scripts:**

- Risk: Status check scripts assume services are on localhost. If services are accessed from outside the container, these would fail or need modification.
- Files: `infra/lukso-node/scripts/status.sh` (lines 7, 12, 23, 34, 40)
- Current mitigation: Scripts are intended to run inside the same host/container.
- Recommendations: Parameterize host addresses via environment variables or config file.

## Performance Bottlenecks

**No caching layer for Proxmox API responses:**

- Problem: Every page load or action queries the Proxmox API directly. Container lists, status checks, and resource usage all hit the PVE API in real-time.
- Files: `apps/dashboard/src/lib/proxmox/`, `apps/dashboard/src/lib/containers/data.ts`
- Cause: No intermediate caching layer between the dashboard and Proxmox API. Redis is available (used for BullMQ) but not leveraged for API response caching.
- Improvement path: Add Redis-based caching for Proxmox API responses with short TTLs (5-15 seconds for status, longer for static config). Use `stale-while-revalidate` pattern.

## Fragile Areas

**Config-manager rollback and snapshot system:**

- Files: `infra/lxc/scripts/config-manager/config-rollback.sh` (729 lines), `infra/lxc/scripts/config-manager/snapshot-manager.sh` (902 lines)
- Why fragile: These are the two largest shell scripts in the codebase and handle critical operations (filesystem rollbacks, snapshot creation/restoration across multiple storage backends: ZFS, LVM, BTRFS, overlay). They have zero test coverage.
- Safe modification: Any changes to rollback or snapshot logic should be accompanied by integration tests. Test against at least one storage backend (overlay is simplest to mock).
- Test coverage: No unit or integration tests exist for `config-rollback.sh`, `snapshot-manager.sh`, or `conflict-detector.sh`.

**Container creation pipeline:**

- Files: `apps/dashboard/src/workers/container-creation.ts`
- Why fragile: The 889-line worker runs a multi-step pipeline (create → configure → install packages → setup services) where each step depends on the previous. Failure partway through leaves containers in a partially-configured state. Error recovery is limited to marking the DB record as `error`.
- Safe modification: Test changes against a real Proxmox instance or add a dry-run mode. The pipeline lacks idempotency — re-running a failed job may leave duplicate resources.
- Test coverage: No tests exist for the worker. Only schema validation is tested in `apps/dashboard/tests/schema.test.ts`.

## Test Coverage Gaps

**Dashboard has 5 test files for 122 source files:**

- What's not tested: Server actions, React components, API route handlers, utility functions, worker pipeline, Proxmox client library, and database operations.
- Files: Only `apps/dashboard/tests/schema.test.ts`, `apps/dashboard/tests/proxmox/containers.test.ts`, `apps/dashboard/tests/proxmox/client.test.ts`, `apps/dashboard/tests/proxmox/auth.test.ts`, `apps/dashboard/tests/proxmox/tasks.test.ts` exist.
- Risk: Regressions in container management, template CRUD, and package management go undetected. Schema changes can break server actions without warning.
- Priority: High — especially for server actions and the container creation worker.

**Config-manager modules missing test coverage:**

- What's not tested: 13 of 16 config-manager shell scripts have no corresponding test file. Missing coverage for: `config-rollback.sh`, `snapshot-manager.sh`, `conflict-detector.sh`, `install-config-manager.sh`, `config-manager-helpers.sh`, and all individual package handlers (`handler-apt.sh`, `handler-apk.sh`, `handler-dnf.sh`, `handler-npm.sh`, `handler-pip.sh`, `handler-custom.sh`, `handler-common.sh`, `handler-logging.sh`).
- Files: `infra/lxc/scripts/config-manager/` (13 untested files)
- Risk: Rollback operations, conflict detection, and package installation across different distros could break silently. The snapshot-manager handles destructive filesystem operations (BTRFS subvolume deletion, LVM snapshot creation) with no test safety net.
- Priority: High for `snapshot-manager.sh` and `config-rollback.sh` (destructive operations). Medium for package handlers (lower blast radius).

**No E2E tests for dashboard:**

- What's not tested: Complete user workflows — creating a template, configuring packages, launching a container, monitoring progress, managing running containers.
- Files: No E2E test directory or framework detected.
- Risk: Integration points between server actions, the BullMQ worker, Proxmox API, and the React UI are only validated manually.
- Priority: Medium — requires real or mocked Proxmox backend, which adds infrastructure complexity.

**Infra scripts (non-config-manager) have no tests:**

- What's not tested: LUKSO node scripts (`infra/lukso-node/scripts/`), LXC template provisioning scripts (`infra/lxc/templates/web3-dev/container-configs/scripts/`), Dokploy install script (`infra/dokploy/install.sh`), ComfyUI start script (`infra/ai/comfy-ui/start.sh`).
- Files: All scripts under `infra/lukso-node/scripts/`, `infra/lxc/templates/web3-dev/container-configs/scripts/`, `infra/dokploy/install.sh`
- Risk: Provisioning scripts run on real infrastructure. A broken script can leave a container in a half-configured state requiring manual intervention.
- Priority: Low — these are run infrequently and are typically validated by manual execution.

## Scaling Limits

**Single BullMQ worker process:**

- Current capacity: One container creation job at a time (serial processing).
- Limit: Creating multiple containers simultaneously is not supported. Jobs queue and execute sequentially.
- Scaling path: Configure BullMQ worker concurrency or run multiple worker instances. Requires ensuring the worker is idempotent and handles concurrent Proxmox API access.

**SQLite/PostgreSQL without connection pooling tuning:**

- Current capacity: Uses Prisma with default connection pool settings.
- Limit: Under high concurrent dashboard usage, database connections could exhaust the pool.
- Scaling path: Configure Prisma connection pool size via `DATABASE_URL` parameters. For production, consider PgBouncer or Prisma Accelerate.

## Dependencies at Risk

**None critical detected:**

- The project uses well-maintained dependencies (Next.js 16, React 19, Prisma 7, BullMQ 5). All are actively maintained with large communities.
- Minor note: The project uses cutting-edge versions (Next.js 16, React 19) which may have less community documentation for edge cases compared to LTS versions.

## Missing Critical Features

**No backup/restore for dashboard database:**

- Problem: Container records, template configurations, and package buckets stored in PostgreSQL have no backup strategy.
- Blocks: Disaster recovery — if the database is lost, all dashboard state is lost. Container relationships, creation history, and custom templates would need to be manually recreated.

**No health check endpoint:**

- Problem: The dashboard has no `/api/health` or equivalent endpoint for monitoring.
- Blocks: Automated monitoring, container orchestration health probes, and load balancer configuration.

---

_Concerns audit: 2026-02-12_
