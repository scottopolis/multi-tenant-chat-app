import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Twilio Number Queries and Mutations
 *
 * SECURITY: All queries MUST filter by tenantId to prevent cross-tenant access
 */

/**
 * Get Twilio number config by phone number (E.164 format)
 * Used by worker to look up which agent handles incoming calls
 */
export const getByPhoneNumber = query({
  args: { phoneNumber: v.string() },
  handler: async (ctx, args) => {
    const twilioNumber = await ctx.db
      .query("twilioNumbers")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();

    if (!twilioNumber) {
      return null;
    }

    // Get the voice agent config
    const voiceAgent = await ctx.db.get(twilioNumber.voiceAgentId);
    if (!voiceAgent || !voiceAgent.enabled) {
      return null;
    }

    // Get the base agent config
    const agent = await ctx.db.get(twilioNumber.agentId);
    if (!agent) {
      return null;
    }

    return {
      numberId: twilioNumber._id,
      tenantId: twilioNumber.tenantId,
      agentId: twilioNumber.agentId,
      voiceAgentId: twilioNumber.voiceAgentId,
      phoneNumber: twilioNumber.phoneNumber,
      // Voice config
      voiceModel: voiceAgent.voiceModel,
      voiceName: voiceAgent.voiceName,
      locale: voiceAgent.locale,
      bargeInEnabled: voiceAgent.bargeInEnabled,
      // Agent config
      agentName: agent.name,
      systemPrompt: agent.systemPrompt || "",
    };
  },
});

/**
 * Get Twilio number by ID
 */
export const getById = query({
  args: { id: v.id("twilioNumbers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * List all Twilio numbers for a tenant
 */
export const listByTenant = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("twilioNumbers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  },
});

/**
 * List all Twilio numbers for an agent
 */
export const listByAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("twilioNumbers")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});

/**
 * Create a new Twilio number mapping
 */
export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    agentId: v.id("agents"),
    voiceAgentId: v.id("voiceAgents"),
    phoneNumber: v.string(),
    description: v.optional(v.string()),
    twilioSid: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if phone number already exists
    const existing = await ctx.db
      .query("twilioNumbers")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.phoneNumber))
      .first();

    if (existing) {
      throw new Error(`Phone number ${args.phoneNumber} is already registered`);
    }

    const now = Date.now();

    return await ctx.db.insert("twilioNumbers", {
      tenantId: args.tenantId,
      agentId: args.agentId,
      voiceAgentId: args.voiceAgentId,
      phoneNumber: args.phoneNumber,
      description: args.description,
      twilioSid: args.twilioSid,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update a Twilio number
 */
export const update = mutation({
  args: {
    id: v.id("twilioNumbers"),
    description: v.optional(v.string()),
    twilioSid: v.optional(v.string()),
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
 * Delete a Twilio number
 */
export const remove = mutation({
  args: { id: v.id("twilioNumbers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
