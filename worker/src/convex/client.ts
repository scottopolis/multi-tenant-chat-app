/**
 * Convex HTTP helpers for Cloudflare Workers
 *
 * Uses direct HTTP API calls to avoid cross-package import issues with
 * Convex's generated files.
 *
 * Usage:
 * ```typescript
 * const result = await convexQuery(env.CONVEX_URL, 'agents:getByAgentId', { agentId: "default" });
 * ```
 */

export interface ConvexQueryResult<T> {
  value: T;
  status: 'success' | 'error';
}

/**
 * Execute a Convex query via HTTP API
 */
export async function convexQuery<T>(
  convexUrl: string,
  path: string,
  args: Record<string, unknown> = {}
): Promise<T | null> {
  if (!convexUrl) {
    throw new Error("CONVEX_URL environment variable is not set");
  }

  const response = await fetch(`${convexUrl}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args }),
  });

  if (!response.ok) {
    console.error('Convex query failed:', response.status, await response.text());
    return null;
  }

  const data: ConvexQueryResult<T> = await response.json();
  return data.value;
}

/**
 * Execute a Convex mutation via HTTP API
 */
export async function convexMutation<T>(
  convexUrl: string,
  path: string,
  args: Record<string, unknown> = {}
): Promise<T | null> {
  if (!convexUrl) {
    throw new Error("CONVEX_URL environment variable is not set");
  }

  const response = await fetch(`${convexUrl}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args }),
  });

  if (!response.ok) {
    console.error('Convex mutation failed:', response.status, await response.text());
    return null;
  }

  const data: ConvexQueryResult<T> = await response.json();
  return data.value;
}
