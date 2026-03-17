Run a comprehensive security gate check on the current project.

Execute `~/.local/bin/security-gate.sh` in the project root and analyze the results.

## Steps

1. Run security-gate.sh and capture output
2. Parse findings from each tool (Semgrep, Trivy, Gitleaks, Slither if Solidity project)
3. Categorize findings by severity (Critical, High, Medium, Low)
4. Provide actionable remediation for Critical and High findings
5. Summarize overall security posture

## Analysis Format

For each tool that reports findings:
- List findings by severity (Critical first)
- For each Critical/High finding: describe the issue, affected file/location, and specific remediation steps
- Provide a one-paragraph executive summary of overall security posture

## Solidity Projects

If this is a Solidity/Foundry project (foundry.toml or hardhat.config.* present), also run `/audit-solidity` for deeper smart contract analysis.

## Exit Guidance

- If security gate passed: confirm the project is ready to proceed
- If warnings: list them but indicate they are non-blocking
- If failures: block proceed and list exact steps to remediate each critical issue
