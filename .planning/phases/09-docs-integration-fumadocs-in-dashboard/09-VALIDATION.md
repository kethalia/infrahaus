---
phase: 9
slug: docs-integration-fumadocs-in-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (unit) + Playwright (E2E) |
| **Config file** | `apps/dashboard/vitest.config.ts` / `apps/dashboard/e2e/` |
| **Quick run command** | `pnpm --filter dashboard test run` |
| **Full suite command** | `pnpm --filter dashboard test run && pnpm --filter dashboard build` |
| **Estimated runtime** | ~30 seconds (unit) + ~60 seconds (build) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter dashboard test run`
- **After every plan wave:** Run `pnpm --filter dashboard build && pnpm --filter dashboard lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | REQ-2.01 | build | `pnpm --filter dashboard build` | ✅ | ⬜ pending |
| 09-01-02 | 01 | 1 | REQ-2.01 | build | `pnpm --filter dashboard exec tsc --noEmit` | ✅ | ⬜ pending |
| 09-01-03 | 01 | 1 | REQ-2.01 | manual | `ls apps/dashboard/.source/` | ✅ | ⬜ pending |
| 09-02-01 | 02 | 2 | REQ-2.01 | E2E | `pnpm --filter dashboard exec playwright test e2e/smoke.test.ts` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 2 | REQ-2.01 | E2E | smoke test: `/docs` renders without JS errors | ❌ W0 | ⬜ pending |
| 09-02-03 | 02 | 2 | REQ-2.06 | E2E | smoke test: dark/light mode toggle on `/docs` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 3 | REQ-2.06 | E2E | smoke test: "Documentation" link present in sidebar | ❌ W0 | ⬜ pending |
| 09-03-02 | 03 | 3 | REQ-2.06 | E2E | smoke test: active state on `/docs/*` paths | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/dashboard/e2e/docs.spec.ts` — E2E tests for /docs routing, sidebar link, and search

*Extend existing smoke test infrastructure rather than install new frameworks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full-text search returns results | REQ-2.01 | Requires authenticated session + indexed content | Log in, go to `/docs`, press Cmd+K, type "install", verify results appear |
| Dark mode CSS isolation | REQ-2.06 | Visual regression — CSS bleed from Fumadocs onto dashboard pages | Toggle dark mode on `/`, verify dashboard colors unchanged; toggle on `/docs`, verify Fumadocs styling correct |
| Sidebar navigation between docs pages | REQ-2.01 | Requires authenticated session | Click docs sidebar links, verify URL changes and content loads |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
