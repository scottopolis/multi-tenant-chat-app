import { v } from "convex/values";
import { mutation, internalMutation } from "./_generated/server";

/**
 * Migration: Set default allowedDomains for existing agents
 *
 * Run this once after deploying schema changes to populate
 * the allowedDomains field for agents created before this feature.
 *
 * Usage: Run from Convex dashboard or via CLI:
 *   npx convex run migrations:setDefaultAllowedDomains
 */
export const setDefaultAllowedDomains = mutation({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db.query("agents").collect();

    let updated = 0;
    for (const agent of agents) {
      if (agent.allowedDomains === undefined) {
        await ctx.db.patch(agent._id, {
          allowedDomains: ["*"], // Default to allow all domains
        });
        updated++;
      }
    }

    return { total: agents.length, updated };
  },
});

/**
 * Migration: Add default scopes to existing API keys
 *
 * Run this once after deploying schema changes to populate
 * the scopes field for API keys created before this feature.
 */
export const setDefaultApiKeyScopes = mutation({
  args: {},
  handler: async (ctx) => {
    const keys = await ctx.db.query("apiKeys").collect();

    let updated = 0;
    for (const key of keys) {
      if (key.scopes === undefined) {
        await ctx.db.patch(key._id, {
          scopes: ["widget:chat"], // Default scope
        });
        updated++;
      }
    }

    return { total: keys.length, updated };
  },
});
