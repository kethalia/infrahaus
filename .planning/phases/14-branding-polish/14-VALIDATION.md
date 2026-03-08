---
phase: 14
slug: branding-polish
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-08
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | grep/bash string checks + visual browser checks |
| **Config file** | none — branding changes only |
| **Quick run command** | `grep -rn "LXC Manager\|LXC Template Manager" apps/dashboard/src/ apps/dashboard/README.md README.md` |
| **Full suite command** | `cd apps/dashboard && npx tsc --noEmit` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick grep check (must return 0 results)
- **After every plan wave:** Run `npx tsc --noEmit` to confirm no type errors
- **Before `/gsd:verify-work`:** Full suite must be green + visual checks complete
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | REQ-2.07 | grep | `grep -n "title" apps/dashboard/src/app/layout.tsx` | ✅ | ⬜ pending |
| 14-01-02 | 01 | 1 | REQ-2.07 | grep | `grep -n "LXC Manager" apps/dashboard/src/components/app-sidebar.tsx` (must be 0) | ✅ | ⬜ pending |
| 14-01-03 | 01 | 1 | REQ-2.07 | grep | `grep -n "LXC Manager" apps/dashboard/src/app/login/page.tsx` (must be 0) | ✅ | ⬜ pending |
| 14-01-04 | 01 | 1 | REQ-2.07 | grep | `grep -n '"name"' apps/dashboard/package.json` (expect @infrahaus/dashboard) | ✅ | ⬜ pending |
| 14-01-05 | 01 | 1 | REQ-2.07 | grep | `grep -rn "LXC Manager" apps/dashboard/src/lib/web3/` (must be 0) | ✅ | ⬜ pending |
| 14-01-06 | 01 | 1 | REQ-2.07 | manual | Favicon updated in apps/dashboard/src/app/ | ✅ | ⬜ pending |
| 14-01-07 | 01 | 1 | REQ-2.07 | grep | `grep -n "filter dashboard" Dockerfile` (must be 0) | ✅ | ⬜ pending |
| 14-01-08 | 01 | 1 | REQ-2.07 | grep | `grep -n "filter dashboard" docker-compose.yml` (must be 0) | ✅ | ⬜ pending |
| 14-01-09 | 01 | 1 | REQ-2.07 | grep | `grep -n "filter dashboard" .github/workflows/ci.yml` (must be 0) | ✅ | ⬜ pending |
| 14-01-10 | 01 | 1 | REQ-2.07 | grep | `grep -n "filter dashboard" apps/dashboard/playwright.config.ts` (must be 0) | ✅ | ⬜ pending |
| 14-01-11 | 01 | 1 | REQ-2.07 | grep | `grep -n "filter dashboard" README.md` (must be 0) | ✅ | ⬜ pending |
| 14-01-12 | 01 | 1 | REQ-2.07 | grep | `grep -n "LXC\|LXC Template Manager" apps/dashboard/README.md` (must be 0) | ✅ | ⬜ pending |
| 14-01-13 | 01 | 1 | REQ-2.07 | manual | `ls apps/dashboard/src/app/icon.svg` exists | ✅ | ⬜ pending |
| 14-01-14 | 01 | 1 | REQ-2.07 | grep | Full audit: `grep -rn "LXC Manager\|LXC Template Manager" apps/dashboard/src/ ...` (must be 0) | ✅ | ⬜ pending |
| 14-01-15 | 01 | 1 | REQ-2.07 | run | `cd apps/dashboard && npx tsc --noEmit` exits 0 | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — branding changes are pure string/file replacements with no new test infrastructure needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser tab shows "Infrahaus" | REQ-2.07 | Requires running dev server and browser | `pnpm dev`, open any dashboard page, check browser tab |
| Favicon displays custom icon | REQ-2.07 | Requires visual browser inspection | Open `/`, check favicon in browser tab |
| Sidebar shows "Infrahaus" | REQ-2.07 | Requires authentication + browser | Log in, check sidebar header text |
| Login page heading says "Infrahaus" | REQ-2.07 | Requires browser rendering | Navigate to `/login`, check card title |
| pnpm --filter still works | REQ-2.07 | Requires running pnpm command | `pnpm --filter @infrahaus/dashboard build` succeeds |

---

## Automated String Verification

```bash
# Full branding audit — must return 0 results
grep -rn "LXC Manager\|LXC Template Manager" \
  apps/dashboard/src/ apps/dashboard/README.md README.md \
  Dockerfile docker-compose.yml .github/ \
  --include="*.ts" --include="*.tsx" --include="*.json" \
  --include="*.md" --include="*.yml" --include="*.yaml"

# Package name check
grep -n '"name"' apps/dashboard/package.json
# Expected: "name": "@infrahaus/dashboard"

# Build check
cd apps/dashboard && npx tsc --noEmit
```

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or manual steps defined
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0: N/A — no test infrastructure needed
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-08
