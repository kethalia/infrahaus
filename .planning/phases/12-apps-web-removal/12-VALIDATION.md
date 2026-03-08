---
phase: 12
slug: apps-web-removal
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-08
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Shell/bash verification commands (no test framework required — deletion + grep checks) |
| **Config file** | none |
| **Quick run command** | `ls apps/web 2>&1 && grep "apps/web" README.md pnpm-lock.yaml 2>/dev/null | head -5` |
| **Full suite command** | `grep -r "apps/web" . --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.json" --include="*.yaml" --include="*.yml" --include="*.md" --exclude-dir=node_modules --exclude-dir=".next" --exclude-dir=".planning"` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command above
- **After every plan wave:** Run full suite command to confirm no dangling references
- **Before `/gsd:verify-work`:** Full suite must return only `.planning/` references
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | REQ-2.04 | shell | `test ! -d apps/web && echo "DELETED" \|\| echo "STILL EXISTS"` | ✅ | ⬜ pending |
| 12-01-02 | 01 | 1 | REQ-2.04 | shell | `grep "apps/web" pnpm-lock.yaml \|\| echo "CLEAN"` — also confirm `pnpm-workspace.yaml` and `turbo.json` contain no stale `web` references: `grep "web" pnpm-workspace.yaml turbo.json \|\| echo "CLEAN"` | ✅ | ⬜ pending |
| 12-01-03 | 01 | 1 | REQ-2.04 | shell | `grep "apps/web" README.md \|\| echo "CLEAN"` | ✅ | ⬜ pending |
| 12-01-04 | 01 | 1 | REQ-2.04 | shell | `grep "apps/web" infra/lxc/docs/SETUP.md \|\| echo "CLEAN"` | ✅ | ⬜ pending |
| 12-01-05 | 01 | 1 | REQ-2.04 | shell | `grep -r "apps/web" . --include="*.ts" --include="*.tsx" --include="*.mjs" --include="*.json" --include="*.yaml" --include="*.yml" --include="*.md" --exclude-dir=node_modules --exclude-dir=".next" --exclude-dir=".next.old" --exclude-dir=".planning" 2>/dev/null \|\| echo "CLEAN"` | ✅ | ⬜ pending |
| 12-01-06 | 01 | 1 | REQ-2.04 | shell | `pnpm --filter dashboard build 2>&1 \| tail -5` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This phase is purely deletion + text edits — no test files need to be created.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| README accurately describes dashboard-centric repo | REQ-2.04 | Content quality requires human review | Read README.md: verify monorepo structure shows `apps/dashboard/`, Quick Start uses port 3002, no mention of docs site |
| SETUP.md link resolves to correct docs page | REQ-2.04 | Link target is a live URL | Check that updated link in `infra/lxc/docs/SETUP.md` points to valid path in `apps/dashboard/content/docs/` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** 2026-03-08
