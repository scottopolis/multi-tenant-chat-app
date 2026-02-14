import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Voice Call Queries and Mutations
 *
 * Used for call logging, analytics, and billing tracking.
 * SECURITY: All queries MUST filter by tenantId to prevent cross-tenant access
 */

const callStatusValidator = v.union(
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("failed")
);

/**
 * Get voice call by Twilio CallSid
 */
export const getByCallSid = query({
  args: { twilioCallSid: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("voiceCalls")
      .withIndex("by_callSid", (q) => q.eq("twilioCallSid", args.twilioCallSid))
      .first();
  },
});

/**
 * Get voice call by ID
 */
export const getById = query({
  args: { id: v.id("voiceCalls") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * List voice calls for a tenant (paginated, most recent first)
 */
export const listByTenant = query({
  args: {
    tenantId: v.id("tenants"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("voiceCalls")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(limit);
  },
});

/**
 * List voice calls for an agent (paginated, most recent first)
 */
export const listByAgent = query({
  args: {
    agentId: v.id("agents"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("voiceCalls")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Create a new voice call record (called when call starts)
 */
export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    agentId: v.id("agents"),
    voiceAgentId: v.id("voiceAgents"),
    twilioNumberId: v.id("twilioNumbers"),
    twilioCallSid: v.string(),
    fromNumber: v.string(),
    toNumber: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if call already exists (idempotency)
    const existing = await ctx.db
      .query("voiceCalls")
      .withIndex("by_callSid", (q) => q.eq("twilioCallSid", args.twilioCallSid))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("voiceCalls", {
      tenantId: args.tenantId,
      agentId: args.agentId,
      voiceAgentId: args.voiceAgentId,
      twilioNumberId: args.twilioNumberId,
      twilioCallSid: args.twilioCallSid,
      fromNumber: args.fromNumber,
      toNumber: args.toNumber,
      status: "in_progress",
      startedAt: Date.now(),
    });
  },
});

/**
 * Update call status (called when call ends or fails)
 */
export const updateStatus = mutation({
  args: {
    twilioCallSid: v.string(),
    status: callStatusValidator,
    durationSec: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const call = await ctx.db
      .query("voiceCalls")
      .withIndex("by_callSid", (q) => q.eq("twilioCallSid", args.twilioCallSid))
      .first();

    if (!call) {
      console.warn(`Voice call not found: ${args.twilioCallSid}`);
      return null;
    }

    await ctx.db.patch(call._id, {
      status: args.status,
      endedAt: Date.now(),
      durationSec: args.durationSec,
    });

    return call._id;
  },
});

/**
 * Update usage metrics (called when call ends with usage data)
 */
export const updateUsage = mutation({
  args: {
    twilioCallSid: v.string(),
    openaiInputTokens: v.optional(v.number()),
    openaiOutputTokens: v.optional(v.number()),
    openaiCostUsd: v.optional(v.number()),
    twilioDurationSec: v.optional(v.number()),
    twilioCostUsd: v.optional(v.number()),
    sttUsageSec: v.optional(v.number()),
    ttsCharacters: v.optional(v.number()),
    deepgramCostUsd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const call = await ctx.db
      .query("voiceCalls")
      .withIndex("by_callSid", (q) => q.eq("twilioCallSid", args.twilioCallSid))
      .first();

    if (!call) {
      console.warn(`Voice call not found: ${args.twilioCallSid}`);
      return null;
    }

    const { twilioCallSid, ...updates } = args;

    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }

    await ctx.db.patch(call._id, filtered);

    return call._id;
  },
});
