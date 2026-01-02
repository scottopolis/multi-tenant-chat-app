import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Voice Agent Queries and Mutations
 *
 * SECURITY: All queries MUST filter by tenantId to prevent cross-tenant access
 */

/**
 * Get voice agent configuration by agent ID
 */
export const getByAgentId = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("voiceAgents")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();
  },
});

/**
 * Get voice agent by ID
 */
export const getById = query({
  args: { id: v.id("voiceAgents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * List all voice agents for a tenant
 */
export const listByTenant = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("voiceAgents")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  },
});

/**
 * Create a new voice agent configuration
 */
export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    agentId: v.id("agents"),
    voiceModel: v.string(),
    voiceName: v.optional(v.string()),
    locale: v.string(),
    bargeInEnabled: v.boolean(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("voiceAgents")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .first();

    if (existing) {
      throw new Error("Voice agent already exists for this agent");
    }

    const now = Date.now();

    return await ctx.db.insert("voiceAgents", {
      tenantId: args.tenantId,
      agentId: args.agentId,
      voiceModel: args.voiceModel,
      voiceName: args.voiceName,
      locale: args.locale,
      bargeInEnabled: args.bargeInEnabled,
      enabled: args.enabled,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update an existing voice agent
 */
export const update = mutation({
  args: {
    id: v.id("voiceAgents"),
    voiceModel: v.optional(v.string()),
    voiceName: v.optional(v.string()),
    locale: v.optional(v.string()),
    bargeInEnabled: v.optional(v.boolean()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }

    await ctx.db.patch(id, {
      ...filtered,
      updatedAt: Date.now(),
    });

    return id;
  },
});

/**
 * Delete a voice agent
 */
export const remove = mutation({
  args: { id: v.id("voiceAgents") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
