---
phase: 10
slug: content-migration-apps-web-to-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Shell scripts + Next.js build |
| **Config file** | none — all validation via shell + build commands |
| **Quick run command** | `diff -rq apps/web/content/docs apps/dashboard/content/docs` |
| **Full suite command** | `pnpm --filter dashboard exec tsc --noEmit && pnpm --filter dashboard lint && NEXT_SKIP_TYPE_CHECK=1 pnpm --filter dashboard build` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `diff -rq apps/web/content/docs apps/dashboard/content/docs`
- **After every plan wave:** Run full build suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | REQ-2.02 | file-count | `find apps/dashboard/content/docs -type f \| wc -l` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | REQ-2.02 | diff | `diff -rq apps/web/content/docs apps/dashboard/content/docs` | ✅ | ⬜ pending |
| 10-02-01 | 02 | 2 | REQ-2.02 | build | `NEXT_SKIP_TYPE_CHECK=1 pnpm --filter dashboard build` | ✅ | ⬜ pending |
| 10-02-02 | 02 | 2 | REQ-2.02 | manual | Route spot-check (6 URLs) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

*No new test files needed — validation is file diff + build.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Route spot-check (6 URLs) | REQ-2.02 | Requires running dev server | Start `pnpm --filter dashboard dev`, check: `/docs`, `/docs/getting-started`, `/docs/getting-started/proxmox-setup`, `/docs/container-templates/configuration`, `/docs/ai/ollama`, `/docs/networking/wireguard` — each must return 200 and render sidebar |
| Sidebar ordering | REQ-2.02 | Visual verification | Confirm each section appears in Fumadocs sidebar with correct ordering per meta.json |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
