/**
 * Authentication Middleware
 *
 * Validates API keys and domain allowlists for widget requests.
 * See specs/widget-security.md for full security model.
 *
 * Flow:
 * 1. Extract API key from Authorization header
 * 2. Hash key and validate against Convex
 * 3. Verify tenant-agent binding (key's tenant must own the agent)
 * 4. Check Origin header against agent's allowedDomains
 * 5. Set context variables for downstream handlers
 */

import type { Context, Next } from "hono";
import { hashApiKey, extractApiKey } from "../security/api-key";
import { validateOrigin } from "../security/domain-allowlist";
import { convexQuery, convexMutation } from "../convex/client";
import { getAgentConfig } from "../tenants/config";

interface ApiKeyInfo {
  id: string;
  tenantId: string;
  keyPrefix: string;
  name: string;
  scopes: string[];
  revokedAt?: number;
}

interface AuthEnv {
  CONVEX_URL?: string;
}

interface AuthVariables {
  tenantId: string;
  agentId: string;
  apiKeyId?: string;
  apiKeyHash?: string;
}

export interface AuthContext {
  Bindings: AuthEnv;
  Variables: AuthVariables;
}

/**
 * Validate an API key against Convex
 */
async function validateApiKey(
  keyHash: string,
  convexUrl: string
): Promise<ApiKeyInfo | null> {
  const result = await convexQuery<ApiKeyInfo>(
    convexUrl,
    "apiKeys:validate",
    { keyHash }
  );

  return result;
}

/**
 * Update the last used timestamp for an API key (fire and forget)
 */
async function updateKeyLastUsed(
  keyHash: string,
  convexUrl: string
): Promise<void> {
  try {
    await convexMutation(convexUrl, "apiKeys:updateLastUsed", { keyHash });
  } catch (error) {
    console.warn("[Auth] Failed to update key last used:", error);
  }
}

/**
 * Auth middleware for widget API endpoints
 *
 * Validates:
 * - API key present and valid
 * - API key belongs to the agent's tenant
 * - Request origin matches agent's allowed domains
 *
 * Sets on context:
 * - tenantId: The tenant ID from the API key
 * - agentId: The agent ID from the request
 * - apiKeyId: The API key document ID
 * - apiKeyHash: The hashed API key (for tracking)
 */
export function authMiddleware() {
  return async (
    c: Context<{ Bindings: AuthEnv; Variables: AuthVariables }>,
    next: Next
  ) => {
    const convexUrl = c.env.CONVEX_URL;
    if (!convexUrl) {
      console.error("[Auth] CONVEX_URL not configured");
      return c.json({ error: "Service configuration error" }, 500);
    }

    // 1. Extract API key
    const authHeader = c.req.header("Authorization");
    const apiKey = extractApiKey(authHeader);

    if (!apiKey) {
      return c.json(
        { error: "Missing API key", code: "MISSING_API_KEY" },
        401
      );
    }

    // 2. Hash and validate key
    const keyHash = await hashApiKey(apiKey);
    const keyInfo = await validateApiKey(keyHash, convexUrl);

    if (!keyInfo) {
      return c.json({ error: "Invalid API key", code: "INVALID_API_KEY" }, 401);
    }

    if (keyInfo.revokedAt) {
      return c.json({ error: "API key revoked", code: "KEY_REVOKED" }, 401);
    }

    // 3. Get agent ID from query param
    const agentId = c.req.query("agent");
    if (!agentId || agentId.trim() === "") {
      return c.json(
        { error: "Missing agent parameter", code: "MISSING_AGENT" },
        400
      );
    }

    // 4. Load agent config and verify tenant binding
    const agentConfig = await getAgentConfig(agentId, { CONVEX_URL: convexUrl });

    if (!agentConfig || agentConfig.agentId === "default") {
      return c.json({ error: "Agent not found", code: "AGENT_NOT_FOUND" }, 404);
    }

    // Get the agent's tenantId from Convex to verify binding
    const agentDoc = await convexQuery<{
      tenantId: string;
      allowedDomains?: string[];
    }>(convexUrl, "agents:getByAgentId", { agentId });

    if (!agentDoc) {
      return c.json({ error: "Agent not found", code: "AGENT_NOT_FOUND" }, 404);
    }

    // Verify the API key's tenant owns this agent
    if (agentDoc.tenantId !== keyInfo.tenantId) {
      return c.json(
        {
          error: "API key not authorized for this agent",
          code: "UNAUTHORIZED_AGENT",
        },
        403
      );
    }

    // 5. Check domain allowlist
    const origin = c.req.header("Origin");
    const allowedDomains = agentDoc.allowedDomains;

    if (!validateOrigin(origin, allowedDomains)) {
      return c.json(
        {
          error: "Origin not allowed",
          code: "ORIGIN_NOT_ALLOWED",
          origin: origin || "(none)",
        },
        403
      );
    }

    // 6. Set context for downstream handlers
    c.set("tenantId", keyInfo.tenantId);
    c.set("agentId", agentId);
    c.set("apiKeyId", keyInfo.id);
    c.set("apiKeyHash", keyHash);

    // 7. Update last used timestamp (fire and forget)
    updateKeyLastUsed(keyHash, convexUrl);

    await next();
  };
}

/**
 * Permissive auth middleware for development/testing
 *
 * Allows requests without API keys but still loads agent config.
 * Use only in development or for specific endpoints.
 */
export function permissiveAuthMiddleware() {
  return async (
    c: Context<{ Bindings: AuthEnv; Variables: AuthVariables }>,
    next: Next
  ) => {
    const convexUrl = c.env.CONVEX_URL;

    // Get agent ID from query param
    const agentParam = c.req.query("agent");
    const agentId =
      agentParam && agentParam.trim() !== "" ? agentParam : "default";

    // Try to load agent config
    const agentConfig = await getAgentConfig(agentId, { CONVEX_URL: convexUrl });

    c.set("agentId", agentId);
    c.set("tenantId", agentConfig.orgId || "unknown");

    // Check for API key (optional in permissive mode)
    const authHeader = c.req.header("Authorization");
    const apiKey = extractApiKey(authHeader);

    if (apiKey && convexUrl) {
      const keyHash = await hashApiKey(apiKey);
      const keyInfo = await validateApiKey(keyHash, convexUrl);

      if (keyInfo && !keyInfo.revokedAt) {
        c.set("apiKeyId", keyInfo.id);
        c.set("apiKeyHash", keyHash);
        c.set("tenantId", keyInfo.tenantId);

        // Update last used timestamp
        updateKeyLastUsed(keyHash, convexUrl);
      }
    }

    await next();
  };
}
