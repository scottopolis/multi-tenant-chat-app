import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

/**
 * Public endpoint to get agent config by agentId
 * Used by the worker to load agent settings without Clerk auth
 *
 * GET /api/agents/:agentId
 */
http.route({
  path: "/api/agents/{agentId}",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/");
    const agentId = pathParts[pathParts.length - 1];

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
