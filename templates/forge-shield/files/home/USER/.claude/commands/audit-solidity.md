Perform a comprehensive Solidity smart contract security audit.

## Steps

1. Run `slither .` in the project root — analyze all findings
2. Run `aderyn .` for additional static analysis
3. If available, run `solhint 'contracts/**/*.sol'` for style and best practices
4. Check for common vulnerability patterns:
   - Reentrancy
   - Integer overflow/underflow (pre-0.8.0)
   - Access control issues
   - Unchecked external calls
   - Front-running vulnerabilities
   - Storage collision in proxies
5. Provide findings organized by severity
6. Suggest specific code fixes for each finding
7. Rate overall contract security (Critical/High/Medium/Low risk)

## Output Format

### Executive Summary
One paragraph describing overall contract security posture.

### Findings by Severity

#### Critical
List any critical findings with file:line references and recommended fixes.

#### High
List any high-severity findings with remediation steps.

#### Medium
List medium findings — note these should be addressed before mainnet.

#### Low / Informational
Brief list of low-severity and informational findings.

### Recommendations
Top 3-5 actionable improvements for the codebase.
