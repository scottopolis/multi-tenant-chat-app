/**
 * Domain Allowlist Utilities
 *
 * Validates that request origins match the configured allowed domains.
 * Supports wildcard patterns like "*.example.com".
 */

/**
 * Check if a hostname matches a domain pattern
 *
 * @param hostname - The hostname to check (e.g., "sub.example.com")
 * @param pattern - The pattern to match (e.g., "*.example.com", "example.com")
 * @returns True if the hostname matches the pattern
 */
export function matchesDomainPattern(
  hostname: string,
  pattern: string
): boolean {
  if (!hostname || !pattern) {
    return false;
  }

  // Normalize inputs
  const normalizedHostname = hostname.toLowerCase().trim();
  const normalizedPattern = pattern.toLowerCase().trim();

  // Wildcard pattern: * matches everything
  if (normalizedPattern === "*") {
    return true;
  }

  // Exact match
  if (normalizedHostname === normalizedPattern) {
    return true;
  }

  // Wildcard subdomain pattern: *.example.com
  if (normalizedPattern.startsWith("*.")) {
    const baseDomain = normalizedPattern.slice(2); // Remove "*."

    // Hostname is exactly the base domain (e.g., "example.com" matches "*.example.com")
    if (normalizedHostname === baseDomain) {
      return true;
    }

    // Hostname is a subdomain (e.g., "sub.example.com" ends with ".example.com")
    if (normalizedHostname.endsWith("." + baseDomain)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a hostname is allowed by any pattern in the allowlist
 *
 * @param hostname - The hostname to check
 * @param allowedDomains - Array of allowed domain patterns
 * @returns True if the hostname is allowed
 */
export function isHostAllowed(
  hostname: string,
  allowedDomains: string[] | undefined
): boolean {
  // If no allowlist is configured, default to allow all
  if (!allowedDomains || allowedDomains.length === 0) {
    return true;
  }

  return allowedDomains.some((pattern) =>
    matchesDomainPattern(hostname, pattern)
  );
}

/**
 * Extract hostname from Origin header
 *
 * @param origin - The Origin header value (e.g., "https://example.com:8080")
 * @returns The hostname or null if invalid
 */
export function getHostnameFromOrigin(origin: string | null): string | null {
  if (!origin) {
    return null;
  }

  try {
    const url = new URL(origin);
    return url.hostname;
  } catch {
    return null;
  }
}

/**
 * Validate an origin against an allowed domains list
 *
 * @param origin - The Origin header value
 * @param allowedDomains - Array of allowed domain patterns
 * @returns True if the origin is allowed
 */
export function validateOrigin(
  origin: string | null,
  allowedDomains: string[] | undefined
): boolean {
  const hostname = getHostnameFromOrigin(origin);

  // No origin header (e.g., server-to-server request)
  // This could be allowed or rejected depending on policy
  if (!hostname) {
    // For widget requests, we expect an Origin header
    // Allow requests without Origin only if wildcard is in allowlist
    return (
      !allowedDomains || allowedDomains.length === 0 || allowedDomains.includes("*")
    );
  }

  return isHostAllowed(hostname, allowedDomains);
}
