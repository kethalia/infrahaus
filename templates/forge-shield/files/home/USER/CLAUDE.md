# forge-shield Environment

This is a **forge-shield** LXC container — a security-focused development environment for smart contract and Web3 project security auditing.

## Environment Overview

- **Container type:** Proxmox LXC (unprivileged)
- **Base OS:** Ubuntu 24.04 LTS
- **Purpose:** Web3 security auditing, smart contract analysis, DAST/SAST scanning

## Languages and Runtimes

| Language | Version | Notes |
|----------|---------|-------|
| Node.js  | 22.x    | LTS, via nvm |
| Python   | 3.12    | System package |
| Go       | 1.23    | Via official tarball |
| Rust     | stable  | Via rustup |

## EVM / Solidity Tools

| Tool | Command | Purpose |
|------|---------|---------|
| Foundry | `forge`, `cast`, `anvil` | Solidity development suite |
| solc-select | `solc-select` | Solidity compiler version manager |
| Solhint | `solhint` | Solidity linter and style checker |

Key paths:
- `~/.foundry/bin` -- forge, cast, anvil, chisel

## Security Tools

| Tool | Command | Purpose |
|------|---------|---------|
| Semgrep | `semgrep` | Static application security testing (SAST) |
| Trivy | `trivy` | Container and filesystem vulnerability scanning |
| Gitleaks | `gitleaks` | Secret detection in git repos |
| Slither | `slither` | Solidity static analyzer |
| Aderyn | `aderyn` | Rust-based Solidity security analyzer |
| Echidna | `echidna` | Solidity fuzzing and property testing |
| Mythril | `myth` | EVM bytecode security analyzer |
| OWASP ZAP | `zap` | Web app dynamic security testing (DAST) |

## Custom Scripts

### security-gate.sh
Run all security tools against a project directory:
```bash
~/.local/bin/security-gate.sh [project-dir]
# Default: current directory
# Runs: Gitleaks, Semgrep, Trivy, Slither (if Solidity project)
# Output: JSON reports in .security-reports/
```

### zap-scan.sh
Run OWASP ZAP baseline scan against a running web app:
```bash
~/.local/bin/zap-scan.sh <target-url> [report-dir]
# Example: ~/.local/bin/zap-scan.sh http://localhost:3000
# Output: HTML report in .security-reports/zap-report.html
```

## Claude Slash Commands

### /security-gate
Run a comprehensive security gate on the current project. Claude will:
1. Execute `security-gate.sh` and capture all tool output
2. Parse findings by severity (Critical, High, Medium, Low)
3. Provide actionable remediation for Critical and High findings
4. Summarize overall security posture

### /audit-solidity
Perform a deep Solidity smart contract security audit. Claude will:
1. Run Slither, Aderyn, and Solhint
2. Check for common vulnerability patterns (reentrancy, overflow, access control, etc.)
3. Rate overall contract security risk
4. Suggest specific code fixes

## Key Paths

| Path | Contents |
|------|---------|
| `~/.foundry/bin` | Foundry tools (forge, cast, anvil, chisel) |
| `~/.cargo/bin` | Rust tools (aderyn, etc.) |
| `~/.local/bin` | Custom scripts (security-gate.sh, zap-scan.sh) |
| `~/go/bin` | Go tools |
| `~/.nvm/versions/node/` | Node.js versions |

## Project Conventions

- **Solidity projects:** Use Foundry (`forge init`, `forge test`, `forge build`)
- **Node.js projects:** Use pnpm (`pnpm install`, `pnpm run ...`)
- **Security reports:** Written to `.security-reports/` in project root (gitignored)

## Security Workflow

1. Before committing: Run `/security-gate` to check for secrets, vulnerabilities, and SAST issues
2. For smart contracts: Run `/audit-solidity` before any deployment
3. For web apps: Run `zap-scan.sh <url>` against staging before production release
4. Reports are saved as JSON/HTML in `.security-reports/` for CI/CD integration

## Notes for Claude Code

- All security tools are pre-installed and on PATH
- Reports directory `.security-reports/` should be added to `.gitignore`
- Slither requires the project to be compiled first (`forge build`)
- Echidna requires property tests written in the `test/` directory
- ZAP requires a running web server to scan
