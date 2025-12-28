import { ConvexHttpClient } from "convex/browser";
import type { api } from "../../../convex/_generated/api";

/**
 * Convex HTTP Client for Cloudflare Workers
 *
 * This client is used to query and mutate Convex data from the worker.
 * It's designed for server-side use (not real-time subscriptions).
 *
 * Usage:
 * ```typescript
 * const client = getConvexClient(env.CONVEX_URL);
 * const agent = await client.query(api.agents.getByAgentId, { agentId: "default" });
 * ```
 */

/**
 * Get or create a Convex HTTP client
 * Clients are cached per URL for efficiency
 */
const clientCache = new Map<string, ConvexHttpClient>();

export function getConvexClient(convexUrl: string): ConvexHttpClient {
  if (!convexUrl) {
    throw new Error("CONVEX_URL environment variable is not set");
  }

  // Return cached client if exists
  if (clientCache.has(convexUrl)) {
    return clientCache.get(convexUrl)!;
  }

  // Create new client
  const client = new ConvexHttpClient(convexUrl);
  clientCache.set(convexUrl, client);

  return client;
}

/**
 * Typed Convex client for better DX
 * Exports the API types for autocomplete
 */
export type ConvexClient = ConvexHttpClient & {
  query: typeof api;
  mutation: typeof api;
};
