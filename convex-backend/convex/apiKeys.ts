import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * API Key Queries and Mutations
 *
 * SECURITY:
 * - Never return the full API key after creation
 * - Store only SHA-256 hashes for validation
 * - Always filter by tenantId
 */

/**
 * Validate API key and return tenant info
 * Used by the worker to authenticate widget requests
 *
 * @param keyHash - SHA-256 hash of the API key
 * @returns Tenant ID and key info, or null if invalid
 */
export const validate = query({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", args.keyHash))
      .first();

    if (!apiKey) {
      return null;
    }

    // Check if key has been revoked
    if (apiKey.revokedAt) {
      return null;
    }

    return {
      id: apiKey._id,
      tenantId: apiKey.tenantId,
      keyPrefix: apiKey.keyPrefix,
      name: apiKey.name,
      scopes: apiKey.scopes ?? ["widget:chat"], // Default scope
      revokedAt: apiKey.revokedAt,
    };
  },
});

/**
 * Update the last used timestamp for an API key
 * Call this after validating a key
 */
export const updateLastUsed = mutation({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", args.keyHash))
      .first();

    if (apiKey) {
      await ctx.db.patch(apiKey._id, {
        lastUsedAt: Date.now(),
      });
    }
  },
});

/**
 * List API keys for a tenant
 * Returns only safe information (no hashes)
 */
export const listByTenant = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // Return only safe fields (no keyHash)
    return keys.map((key) => ({
      id: key._id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes ?? ["widget:chat"],
      lastUsedAt: key.lastUsedAt,
      revokedAt: key.revokedAt,
      createdAt: key.createdAt,
    }));
  },
});

/**
 * Create a new API key
 *
 * @param tenantId - Tenant ID
 * @param keyHash - SHA-256 hash of the generated API key
 * @param keyPrefix - First 8 chars of the key for display (e.g., "sk_live_")
 * @param name - Human-readable name for the key
 * @returns The created key ID (NOT the actual key - that should be shown only once)
 */
export const create = mutation({
  args: {
    tenantId: v.id("tenants"),
    keyHash: v.string(),
    keyPrefix: v.string(),
    name: v.string(),
    scopes: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("apiKeys", {
      tenantId: args.tenantId,
      keyHash: args.keyHash,
      keyPrefix: args.keyPrefix,
      name: args.name,
      scopes: args.scopes ?? ["widget:chat"], // Default scope
      createdAt: Date.now(),
    });
  },
});

/**
 * Revoke an API key (soft delete - marks as revoked)
 *
 * SECURITY: Verify that the key belongs to the requesting tenant
 */
export const revoke = mutation({
  args: {
    id: v.id("apiKeys"),
    tenantId: v.id("tenants"), // For verification
  },
  handler: async (ctx, args) => {
    const apiKey = await ctx.db.get(args.id);

    if (!apiKey) {
      throw new Error("API key not found");
    }

    // Verify ownership
    if (apiKey.tenantId !== args.tenantId) {
      throw new Error("Unauthorized: API key does not belong to this tenant");
    }

    // Already revoked
    if (apiKey.revokedAt) {
      return;
    }

    // Soft delete - mark as revoked
    await ctx.db.patch(args.id, {
      revokedAt: Date.now(),
    });
  },
});
