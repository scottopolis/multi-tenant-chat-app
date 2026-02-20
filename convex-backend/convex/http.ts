import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

function requireHttpSecret(request: Request): Response | null {
  const secret = process.env.CONVEX_HTTP_SECRET;
  if (!secret) return null;

  const header =
    request.headers.get("Authorization") ||
    request.headers.get("X-Convex-Auth");

  if (!header) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
  if (token !== secret) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return null;
}

/**
 * Public endpoint to validate API key
 * Used by the worker to authenticate widget requests
 *
 * POST /api/keys/validate
 * Body: { keyHash: string }
 */
http.route({
  path: "/api/keys/validate",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const authError = requireHttpSecret(request);
      if (authError) return authError;

      const body = await request.json();
      const keyHash = body.keyHash;

      if (!keyHash || typeof keyHash !== "string") {
        return new Response(JSON.stringify({ error: "keyHash is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const result = await ctx.runQuery(api.apiKeys.validate, { keyHash });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      console.error("API key validation error:", error);
      return new Response(JSON.stringify({ error: "Validation failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

/**
 * Public endpoint to update API key last used timestamp
 * Used by the worker after successful authentication
 *
 * POST /api/keys/touch
 * Body: { keyHash: string }
 */
http.route({
  path: "/api/keys/touch",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const authError = requireHttpSecret(request);
      if (authError) return authError;

      const body = await request.json();
      const keyHash = body.keyHash;

      if (!keyHash || typeof keyHash !== "string") {
        return new Response(JSON.stringify({ error: "keyHash is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      await ctx.runMutation(api.apiKeys.updateLastUsed, { keyHash });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      console.error("API key touch error:", error);
      return new Response(JSON.stringify({ error: "Update failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

/**
 * Public endpoint to get agent config by agentId
 * Used by the worker to load agent settings without Clerk auth
 *
 * GET /api/agents/:agentId
 */
http.route({
  pathPrefix: "/api/agents/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const authError = requireHttpSecret(request);
    if (authError) return authError;

    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const agentId = decodeURIComponent(pathParts[pathParts.length - 1]);

    if (!agentId) {
      return new Response(JSON.stringify({ error: "agentId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const agent = await ctx.runQuery(api.agents.getByAgentId, { agentId });

    if (!agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(agent), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

export default http;
