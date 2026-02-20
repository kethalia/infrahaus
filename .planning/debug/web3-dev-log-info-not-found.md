---
status: investigating
trigger: "web3-dev template: /tmp/00-pre-checks.sh: line 10: log_info: command not found"
created: 2026-02-17T00:00:00Z
updated: 2026-02-17T00:00:00Z
---

## Current Focus

hypothesis: log_info is defined in a shared lib/helpers script that is not being sourced before 00-pre-checks.sh executes
test: find where log_info is defined and how scripts are executed
expecting: scripts need a source of the helpers file before running
next_action: locate template structure and script runner

## Symptoms

expected: 00-pre-checks.sh runs successfully with log_info available
actual: /tmp/00-pre-checks.sh: line 10: log_info: command not found
errors: "log_info: command not found" at line 10 of 00-pre-checks.sh
reproduction: create container with web3-dev template
started: unknown

## Eliminated

## Evidence

## Resolution

root_cause:
fix:
verification:
files_changed: []
