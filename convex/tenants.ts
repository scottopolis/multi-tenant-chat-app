import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Tenant Queries and Mutations
 */

/**
 * Get tenant by Clerk organization ID
 * Used to map Clerk auth to our internal tenant
 */
export const getByClerkOrgId = query({
  args: { clerkOrgId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tenants")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first();
  },
});

/**
 * Get tenant by ID
 */
export const get = query({
  args: { id: v.id("tenants") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * List all tenants (admin only - be careful with this!)
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tenants").collect();
  },
});

/**
 * Create a new tenant
 * Called when a new organization signs up
 */
export const create = mutation({
  args: {
    clerkOrgId: v.string(),
    name: v.string(),
    plan: v.optional(v.string()), // Defaults to "free"
  },
  handler: async (ctx, args) => {
    // Check if tenant already exists
    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_clerk_org", (q) => q.eq("clerkOrgId", args.clerkOrgId))
      .first();

    if (existing) {
      throw new Error(`Tenant with Clerk org ID "${args.clerkOrgId}" already exists`);
    }

    return await ctx.db.insert("tenants", {
      clerkOrgId: args.clerkOrgId,
      name: args.name,
      plan: args.plan ?? "free",
      createdAt: Date.now(),
    });
  },
});

/**
 * Update tenant
 */
export const update = mutation({
  args: {
    id: v.id("tenants"),
    name: v.optional(v.string()),
    plan: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

/**
 * Delete tenant
 * WARNING: This should cascade delete all related data (agents, api keys, documents, embeddings)
 */
export const remove = mutation({
  args: { id: v.id("tenants") },
  handler: async (ctx, args) => {
    // TODO: In production, implement cascade delete for related data
    // - Delete all agents for this tenant
    // - Delete all API keys
    // - Delete all documents and embeddings
    // For now, just delete the tenant
    await ctx.db.delete(args.id);
  },
});
