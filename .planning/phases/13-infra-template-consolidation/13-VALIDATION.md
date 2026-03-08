---
phase: 13
slug: infra-template-consolidation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-08
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit) + tsc + ESLint (build-time) |
| **Config file** | `apps/dashboard/vitest.config.ts` |
| **Quick run command** | `pnpm --filter dashboard exec tsc --noEmit` |
| **Full suite command** | `pnpm --filter dashboard test run && pnpm --filter dashboard exec tsc --noEmit && pnpm --filter dashboard lint` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter dashboard exec tsc --noEmit`
- **After every plan wave:** Run `pnpm --filter dashboard test run && pnpm --filter dashboard exec tsc --noEmit && pnpm --filter dashboard lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | REQ-2.05 | build | `pnpm --filter dashboard exec tsc --noEmit` | ✅ | ⬜ pending |
| 13-01-02 | 01 | 1 | REQ-2.05 | manual | Discover Templates UI | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | REQ-2.05 | manual | Template card renders | ❌ W0 | ⬜ pending |
| 13-02-01 | 02 | 2 | REQ-2.06 | build | `pnpm --filter dashboard exec tsc --noEmit` | ✅ | ⬜ pending |
| 13-02-02 | 02 | 2 | REQ-2.06 | manual | /infra page renders | ❌ W0 | ⬜ pending |
| 13-02-03 | 02 | 2 | REQ-2.06 | manual | Sidebar nav item active | ❌ W0 | ⬜ pending |
| 13-03-01 | 03 | 3 | REQ-2.05 | build | `NEXT_SKIP_TYPE_CHECK=1 pnpm --filter dashboard build` (MDX validation) | ✅ | ⬜ pending |
| 13-03-02 | 03 | 3 | REQ-2.06 | manual | Docs callouts render + links work | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all automated phase requirements. No new test stubs needed — type checking and linting are the primary automated gates. Manual verification is required for UI rendering.

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dokploy template appears after "Discover Templates" click | REQ-2.05 | Requires running dashboard + DB | Click Discover, verify card in grid with correct name/tags/resources |
| `/infra` page renders all service categories | REQ-2.06 | Requires running dashboard | Navigate to /infra, verify cards for ai/media/gaming/blockchain/deployment/networking |
| Sidebar "Infra" nav item active state | REQ-2.06 | Requires browser visual check | Navigate to /infra, verify active highlight; navigate away, verify deactivates |
| Docs callout links functional | REQ-2.05 | Requires running dashboard + docs | Navigate to /docs/deployment/dokploy, click template link, verify navigation |
| Tag filtering on /templates | REQ-2.05 | Requires running dashboard | Navigate to /templates?tags=infra, verify only infra-tagged templates shown |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
