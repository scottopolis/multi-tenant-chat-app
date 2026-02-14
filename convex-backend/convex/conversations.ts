import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Conversation Queries and Mutations
 *
 * SECURITY: All operations derive tenantId from the agent, never trust caller.
 * Access validation checks conversation.tenantId === agent.tenantId.
 */

const eventValidator = v.object({
  eventType: v.union(
    v.literal("message"),
    v.literal("tool_call"),
    v.literal("tool_result"),
    v.literal("system"),
    v.literal("error")
  ),
  role: v.optional(
    v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool")
    )
  ),
  content: v.optional(v.string()),
  model: v.optional(v.string()),
  providerResponseId: v.optional(v.string()),
  toolName: v.optional(v.string()),
  toolCallId: v.optional(v.string()),
  toolInput: v.optional(v.any()),
  toolResult: v.optional(v.any()),
  errorType: v.optional(v.string()),
  errorMessage: v.optional(v.string()),
  metadata: v.optional(v.any()),
});

const contextValidator = v.object({
  pageUrl: v.optional(v.string()),
  referrer: v.optional(v.string()),
  userAgent: v.optional(v.string()),
  locale: v.optional(v.string()),
  timezone: v.optional(v.string()),
  customMetadata: v.optional(v.any()),
});

/**
 * Validate access to a conversation
 * Gets agent, verifies it exists, then verifies conversation ownership
 */
async function validateAccess(
  ctx: { db: { query: any; get: any } },
  agentId: string,
  conversationId: Id<"conversations">
) {
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_agent_id", (q: any) => q.eq("agentId", agentId))
    .first();

  if (!agent) {
    throw new Error("Agent not found");
  }

  const conversation = await ctx.db.get(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (
    conversation.tenantId !== agent.tenantId ||
    conversation.agentId !== agent._id
  ) {
    throw new Error("Access denied");
  }

  return { agent, conversation };
}

/**
 * Create a new conversation
 */
export const create = mutation({
  args: {
    agentId: v.string(),
    sessionId: v.string(),
    userId: v.optional(v.string()),
    title: v.optional(v.string()),
    context: v.optional(contextValidator),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agent_id", (q) => q.eq("agentId", args.agentId))
      .first();

    if (!agent) {
      throw new Error("Agent not found");
    }

    const now = Date.now();

    const conversationId = await ctx.db.insert("conversations", {
      tenantId: agent.tenantId,
      agentId: agent._id,
      orgId: agent.orgId,
      sessionId: args.sessionId,
      userId: args.userId,
      title: args.title,
      status: "active",
      context: args.context,
      events: [],
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
      lastEventAt: now,
    });

    return conversationId;
  },
});

/**
 * Append a single event to a conversation
 */
export const appendEvent = mutation({
  args: {
    agentId: v.string(),
    conversationId: v.id("conversations"),
    event: eventValidator,
  },
  handler: async (ctx, args) => {
    const { conversation } = await validateAccess(
      ctx,
      args.agentId,
      args.conversationId
    );

    const now = Date.now();
    const nextSeq = conversation.events.length;

    const newEvent = {
      seq: nextSeq,
      ...args.event,
      createdAt: now,
    };

    await ctx.db.patch(args.conversationId, {
      events: [...conversation.events, newEvent],
      updatedAt: now,
      lastEventAt: now,
    });

    return newEvent;
  },
});

/**
 * Append multiple events to a conversation (batch)
 */
export const appendEvents = mutation({
  args: {
    agentId: v.string(),
    conversationId: v.id("conversations"),
    events: v.array(eventValidator),
  },
  handler: async (ctx, args) => {
    const { conversation } = await validateAccess(
      ctx,
      args.agentId,
      args.conversationId
    );

    const now = Date.now();
    let nextSeq = conversation.events.length;

    const newEvents = args.events.map((event) => ({
      seq: nextSeq++,
      ...event,
      createdAt: now,
    }));

    await ctx.db.patch(args.conversationId, {
      events: [...conversation.events, ...newEvents],
      updatedAt: now,
      lastEventAt: now,
    });

    return newEvents;
  },
});

/**
 * Update last response ID (for provider conversation tracking)
 */
export const updateLastResponseId = mutation({
  args: {
    agentId: v.string(),
    conversationId: v.id("conversations"),
    responseId: v.string(),
  },
  handler: async (ctx, args) => {
    await validateAccess(ctx, args.agentId, args.conversationId);

    await ctx.db.patch(args.conversationId, {
      lastResponseId: args.responseId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Archive a conversation
 */
export const archive = mutation({
  args: {
    agentId: v.string(),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    await validateAccess(ctx, args.agentId, args.conversationId);

    await ctx.db.patch(args.conversationId, {
      status: "archived",
      updatedAt: Date.now(),
    });
  },
});

/**
 * Delete a conversation permanently
 */
export const remove = mutation({
  args: {
    agentId: v.string(),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    await validateAccess(ctx, args.agentId, args.conversationId);
    await ctx.db.delete(args.conversationId);
  },
});

/**
 * Get a conversation with all events
 */
export const get = query({
  args: {
    agentId: v.string(),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const { conversation } = await validateAccess(
      ctx,
      args.agentId,
      args.conversationId
    );

    return conversation;
  },
});

/**
 * List conversations by session ID (for anonymous users)
 */
export const listBySession = query({
  args: {
    agentId: v.string(),
    sessionId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agent_id", (q) => q.eq("agentId", args.agentId))
      .first();

    if (!agent) {
      return [];
    }

    const limit = args.limit ?? 50;

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_session", (q) =>
        q
          .eq("tenantId", agent.tenantId)
          .eq("agentId", agent._id)
          .eq("sessionId", args.sessionId)
      )
      .order("desc")
      .take(limit);

    return conversations;
  },
});

/**
 * List conversations by user ID (for authenticated users)
 */
export const listByUser = query({
  args: {
    agentId: v.string(),
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agent_id", (q) => q.eq("agentId", args.agentId))
      .first();

    if (!agent) {
      return [];
    }

    const limit = args.limit ?? 50;

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) =>
        q
          .eq("tenantId", agent.tenantId)
          .eq("agentId", agent._id)
          .eq("userId", args.userId)
      )
      .order("desc")
      .take(limit);

    return conversations;
  },
});

/**
 * List all conversations for an agent (dashboard use)
 */
export const listByAgent = query({
  args: {
    agentId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agent_id", (q) => q.eq("agentId", args.agentId))
      .first();

    if (!agent) {
      return [];
    }

    const limit = args.limit ?? 50;

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_agent_lastEvent", (q) => q.eq("agentId", agent._id))
      .order("desc")
      .take(limit);

    return conversations;
  },
});

/**
 * List all conversations for a tenant (dashboard use)
 * Used when viewing all conversations across agents
 */
export const listByTenant = query({
  args: {
    tenantId: v.id("tenants"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_tenant_lastEvent", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .take(limit);

    return conversations;
  },
});

/**
 * Get a conversation by ID for dashboard (tenant-scoped)
 * Validates tenant ownership, used by dashboard transcript viewer
 */
export const getForDashboard = query({
  args: {
    tenantId: v.id("tenants"),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);

    if (!conversation) {
      return null;
    }

    if (conversation.tenantId !== args.tenantId) {
      return null;
    }

    // Get agent info for display
    const agent = await ctx.db.get(conversation.agentId);

    return {
      ...conversation,
      agentName: agent?.name ?? "Unknown Agent",
      agentStringId: agent?.agentId ?? null,
    };
  },
});

/**
 * Get usage stats for a tenant (dashboard analytics)
 * Returns total conversations, total messages, unique sessions, and monthly breakdown
 */
export const getUsageStats = query({
  args: {
    tenantId: v.id("tenants"),
  },
  handler: async (ctx, args) => {
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_tenant_lastEvent", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    const totalConversations = conversations.length;

    let totalMessages = 0;
    const uniqueSessions = new Set<string>();
    const monthlyData: Record<string, number> = {};

    const now = Date.now();
    const sixMonthsAgo = now - 6 * 30 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    let last30Conversations = 0;
    let last30Messages = 0;

    for (const conv of conversations) {
      uniqueSessions.add(conv.sessionId);

      if (conv.lastEventAt >= thirtyDaysAgo) {
        last30Conversations++;
      }

      for (const event of conv.events) {
        if (event.eventType === "message") {
          totalMessages++;

          if (event.createdAt >= thirtyDaysAgo) {
            last30Messages++;
          }

          if (event.createdAt >= sixMonthsAgo) {
            const date = new Date(event.createdAt);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
          }
        }
      }
    }

    const sortedMonths = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, messages]) => {
        const [year, monthNum] = month.split("-");
        const date = new Date(parseInt(year), parseInt(monthNum) - 1);
        return {
          month: date.toLocaleDateString("en-US", { month: "long" }),
          messages,
        };
      });

    return {
      totalConversations,
      totalMessages,
      uniqueSessions: uniqueSessions.size,
      last30Conversations,
      last30Messages,
      monthlyData: sortedMonths,
    };
  },
});
