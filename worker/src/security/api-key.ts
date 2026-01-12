/**
 * API Key Utilities
 *
 * Hashing and validation helpers for API keys.
 */

/**
 * Compute SHA-256 hash of an API key
 * Uses Web Crypto API available in Cloudflare Workers
 */
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Extract API key from Authorization header
 *
 * @param authHeader - The Authorization header value
 * @returns The API key or null if invalid format
 */
export function extractApiKey(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  const key = authHeader.slice(7).trim();
  return key.length > 0 ? key : null;
}

/**
 * Generate a new API key with prefix
 *
 * @returns Object with full key and prefix for display
 */
export function generateApiKey(): { key: string; prefix: string } {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const randomPart = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const key = `pk_live_${randomPart}`;
  const prefix = key.slice(0, 12); // "pk_live_xxxx"

  return { key, prefix };
}
