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
    c.header("Vary", "Origin");

    await next();

    // If no CORS header was set by auth middleware (e.g., for public routes),
    // and there's an origin, set permissive CORS headers.
    // This allows the widget to work before full auth middleware is enabled.
    if (origin && !c.res.headers.get("Access-Control-Allow-Origin")) {
      c.header("Access-Control-Allow-Origin", origin);
    }
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
