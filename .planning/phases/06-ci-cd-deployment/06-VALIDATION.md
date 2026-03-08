---
phase: 06
slug: ci-cd-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit) + Playwright (E2E) |
| **Config file** | `apps/dashboard/vitest.config.ts` |
| **Quick run command** | `pnpm --filter dashboard test run` |
| **Full suite command** | `pnpm --filter dashboard test run && docker build --no-cache -t infrahaus-test .` |
| **Estimated runtime** | ~30 seconds (unit) + ~120 seconds (docker build) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter dashboard test run`
- **After every plan wave:** Run `pnpm --filter dashboard test run && docker build --no-cache -t infrahaus-test .`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds (unit tests)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | Docker | build | `docker build -t infrahaus-test .` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | Docker | build | `docker build -t infrahaus-test .` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | Compose | smoke | `docker compose config` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | CI | lint | `pnpm lint` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Dockerfile fixed (correct workspace `apps/dashboard`, standalone output)
- [ ] `next.config.ts` updated with `output: "standalone"`
- [ ] Existing vitest infrastructure covers unit tests

*Existing test infrastructure partially covers phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full stack compose deploy | Docker | Requires live Proxmox node | `docker compose up` on target host |
| SIWE auth E2E | Auth | Headless wallet signing not feasible in CI | Manual browser test with MetaMask |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
