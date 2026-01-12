/**
 * Dynamic CORS Middleware
 *
 * Handles CORS in coordination with the auth middleware:
 * - OPTIONS (preflight): Returns permissive headers (actual validation on real request)
 * - Other requests: Auth middleware sets CORS headers after domain validation
 *
 * See specs/widget-security.md for full security model.
 */

import type { Context, Next } from "hono";

export interface CorsEnv {
  CONVEX_URL?: string;
}

/**
 * Dynamic CORS middleware
 *
 * For preflight (OPTIONS) requests:
 * - Allow origin temporarily with CORS headers
 * - Return 204 No Content
 *
 * For actual requests:
 * - Set Vary: Origin header
 * - CORS headers are set by auth middleware after domain validation
 */
export function dynamicCors() {
  return async (c: Context<{ Bindings: CorsEnv }>, next: Next) => {
    const origin = c.req.header("Origin");

    // Handle preflight OPTIONS requests
    if (c.req.method === "OPTIONS") {
      c.header("Access-Control-Allow-Origin", origin || "*");
      c.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      c.header("Access-Control-Max-Age", "86400");
      c.header("Vary", "Origin");

      return c.body(null, 204);
    }

    // For non-OPTIONS requests, set Vary header
    // The actual Access-Control-Allow-Origin will be set by auth middleware
    // after validating the origin against allowedDomains
    c.header("Vary", "Origin");

    // For requests without Origin (e.g., same-origin, curl, server-to-server),
    // allow them through. The auth middleware will handle API key validation.
    if (origin) {
      // Origin is present - auth middleware will validate and set CORS headers
      // If origin is invalid, auth middleware will return 403
    }

    await next();

    // If no CORS header was set by auth middleware (e.g., for public routes),
    // and there's an origin, we need to decide what to do.
    // For now, we'll leave it - public routes should set their own CORS.
  };
}

/**
 * Set CORS headers for a validated origin
 * Call this from auth middleware after validating the origin
 */
export function setCorsHeaders(c: Context, origin: string) {
  c.header("Access-Control-Allow-Origin", origin);
  c.header("Vary", "Origin");
}
