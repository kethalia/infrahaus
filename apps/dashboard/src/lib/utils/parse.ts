/**
 * Generic string parsing utilities.
 */

/**
 * Parse a string into a key-value Record, supporting multiple formats:
 *
 * 1. **JSON object**: `{"username":"root","password":"secret"}`
 * 2. **Key=value lines**: `username=root\npassword=secret`
 * 3. **Raw value fallback**: treats the entire string as a "password" entry
 *
 * Returns null for empty/whitespace-only strings.
 */
export function parseKeyValueString(
  input: string,
): Record<string, string> | null {
  // Try JSON first
  try {
    const parsed = JSON.parse(input);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, string>;
    }
  } catch {
    // Not JSON — try other formats
  }

  // Try key=value lines (e.g. "username=root\npassword=secret")
  if (input.includes("=")) {
    const result: Record<string, string> = {};
    for (const line of input.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        result[trimmed.slice(0, eqIdx).trim()] = trimmed
          .slice(eqIdx + 1)
          .trim();
      }
    }
    if (Object.keys(result).length > 0) {
      return result;
    }
  }

  // Raw value fallback
  if (input.trim()) {
    return { password: input.trim() };
  }

  return null;
}
