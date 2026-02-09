/**
 * Input validation and sanitization utilities.
 */

/**
 * Regex pattern for shell-safe arguments.
 * Allows only alphanumeric characters, hyphens, underscores, dots, and @.
 * Covers valid systemd unit names and filesystem paths without
 * shell metacharacters.
 */
const SAFE_SHELL_ARG = /^[a-zA-Z0-9._@-]+$/;

/**
 * Validate that a string is safe for use in a shell command.
 * Rejects strings containing shell metacharacters, spaces, or
 * other characters that could enable injection attacks.
 */
export function isSafeShellArg(value: string): boolean {
  return SAFE_SHELL_ARG.test(value);
}
