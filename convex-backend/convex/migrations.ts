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

/**
 * Migration: Backfill required voice agent fields for Deepgram pipeline
 *
 * Run this once after deploying schema changes to populate
 * new required fields for existing voice agents.
 *
 * Usage:
 *   npx convex run migrations:setDefaultVoiceAgentFields
 */
export const setDefaultVoiceAgentFields = mutation({
  args: {},
  handler: async (ctx) => {
    const voiceAgents = await ctx.db.query("voiceAgents").collect();

    let updated = 0;
    for (const voiceAgent of voiceAgents) {
      const patch: Record<string, unknown> = {};

      if (voiceAgent.sttProvider === undefined) patch.sttProvider = "deepgram";
      if (voiceAgent.ttsProvider === undefined) patch.ttsProvider = "deepgram";
      if (voiceAgent.sttModel === undefined) patch.sttModel = "nova-3";
      if (voiceAgent.ttsModel === undefined) patch.ttsModel = "aura-2-thalia-en";
      if (voiceAgent.locale === undefined) patch.locale = "en-US";
      if (voiceAgent.bargeInEnabled === undefined) patch.bargeInEnabled = true;
      if (voiceAgent.enabled === undefined) patch.enabled = true;
      if (voiceAgent.createdAt === undefined) patch.createdAt = Date.now();

      if (Object.keys(patch).length > 0) {
        patch.updatedAt = Date.now();
        await ctx.db.patch(voiceAgent._id, patch);
        updated++;
      }
    }

    return { total: voiceAgents.length, updated };
  },
});
