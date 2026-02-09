/**
 * Error classification utilities.
 */

/**
 * Classify whether an Error is a network/TLS connectivity error.
 * Checks both the error message and its cause chain for known
 * network-related patterns (DNS, timeout, TLS, connection refused).
 *
 * Used to provide user-friendly messages like "Unable to reach server"
 * instead of leaking internal error details.
 */
export function isNetworkError(error: Error): boolean {
  const msg = (
    error.message +
    (error.cause instanceof Error ? " " + error.cause.message : "")
  ).toLowerCase();

  return (
    msg.includes("fetch") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("etimedout") ||
    msg.includes("ehostunreach") ||
    msg.includes("cert") ||
    msg.includes("certificate") ||
    msg.includes("self-signed") ||
    msg.includes("ssl") ||
    msg.includes("unable to verify")
  );
}
