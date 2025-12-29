import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Agent Queries and Mutations
 *
 * SECURITY: All queries MUST filter by tenantId to prevent cross-tenant access
 */

/**
 * Get agent configuration by agentId
 * Used by the worker to load agent settings
 */
export const getByAgentId = query({
  args: { agentId: v.string() },
  handler: async (ctx, args) => {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_agent_id", (q) => q.eq("agentId", args.agentId))
      .first();

    if (!agent) {
      return null;
    }

    // Parse MCP servers and output schema from JSON strings
    return {
      ...agent,
      mcpServers: agent.mcpServers ? JSON.parse(agent.mcpServers) : [],
      outputSchema: agent.outputSchema ?? "",
      langfuse: {
        publicKey: agent.langfusePublicKey,
        secretKey: agent.langfuseSecretKey,
        host: agent.langfuseHost,
        promptName: agent.langfusePromptName,
        label: agent.langfuseLabel,
      },
    };
  },
});

/**
 * Get agent by internal ID
 * Used by the dashboard for editing
 */
export const getById = query({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id);
    if (!agent) return null;

    return {
      ...agent,
      mcpServers: agent.mcpServers ? JSON.parse(agent.mcpServers) : [],
      outputSchema: agent.outputSchema ?? "",
      langfuse: {
        publicKey: agent.langfusePublicKey,
        secretKey: agent.langfuseSecretKey,
        host: agent.langfuseHost,
        promptName: agent.langfusePromptName,
        label: agent.langfuseLabel,
      },
    };
  },
});

/**
 * List all agents for a tenant
 * Used by the dashboard to show agent list
 */
export const listByTenant = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();
  },
});

/**
 * List all agents for an organization
 * Used when querying by orgId instead of tenantId
 */
export const listByOrgId = query({
  args: { orgId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agents")
      .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
      .collect();
  },
});

/**
 * Create a new agent
 */
export const create = mutation({
  args: {
    agentId: v.string(),
    tenantId: v.id("tenants"),
    orgId: v.string(),
    name: v.string(),
    systemPrompt: v.optional(v.string()),
    model: v.string(),
    // Langfuse config (optional)
    langfusePublicKey: v.optional(v.string()),
    langfuseSecretKey: v.optional(v.string()),
    langfuseHost: v.optional(v.string()),
    langfusePromptName: v.optional(v.string()),
    langfuseLabel: v.optional(v.string()),
    // MCP servers (JSON string)
    mcpServers: v.optional(v.string()),
    // Output schema (JSON string)
    outputSchema: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if agentId already exists
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_agent_id", (q) => q.eq("agentId", args.agentId))
      .first();

    if (existing) {
      throw new Error(`Agent with ID "${args.agentId}" already exists`);
    }

    const now = Date.now();

    return await ctx.db.insert("agents", {
      agentId: args.agentId,
      tenantId: args.tenantId,
      orgId: args.orgId,
      name: args.name,
      systemPrompt: args.systemPrompt,
      model: args.model,
      langfusePublicKey: args.langfusePublicKey,
      langfuseSecretKey: args.langfuseSecretKey,
      langfuseHost: args.langfuseHost,
      langfusePromptName: args.langfusePromptName,
      langfuseLabel: args.langfuseLabel,
      mcpServers: args.mcpServers,
      outputSchema: args.outputSchema,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update an existing agent
 */
export const update = mutation({
  args: {
    id: v.id("agents"),
    name: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    model: v.optional(v.string()),
    langfusePublicKey: v.optional(v.string()),
    langfuseSecretKey: v.optional(v.string()),
    langfuseHost: v.optional(v.string()),
    langfusePromptName: v.optional(v.string()),
    langfuseLabel: v.optional(v.string()),
    mcpServers: v.optional(v.string()),
    outputSchema: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    return id;
  },
});

/**
 * Delete an agent
 */
export const remove = mutation({
  args: { id: v.id("agents") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
