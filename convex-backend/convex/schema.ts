import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Multi-Tenant Chat Assistant Database Schema
 *
 * This schema supports:
 * - Multi-tenant isolation via tenantId
 * - Agent configurations with Langfuse integration
 * - API key management
 * - Document storage and vector embeddings for RAG
 *
 * Security: All queries MUST filter by tenantId to prevent cross-tenant data access
 */

export default defineSchema({
  /**
   * Tenants (Organizations)
   * Each tenant represents a customer organization using the platform
   */
  tenants: defineTable({
    clerkOrgId: v.string(), // Clerk organization ID (for auth integration)
    name: v.string(), // Display name
    plan: v.string(), // Billing tier: "free" | "pro" | "enterprise"
    createdAt: v.number(), // Unix timestamp
  })
    .index("by_clerk_org", ["clerkOrgId"]), // Lookup by Clerk org ID (unique)

  /**
   * Agents
   * Each agent is a configured chatbot instance with specific behavior
   * Agents belong to tenants and have their own settings
   */
  agents: defineTable({
    agentId: v.string(), // Unique agent identifier (e.g., "acme-support")
    tenantId: v.id("tenants"), // Reference to tenant
    orgId: v.string(), // Denormalized org identifier for easier queries
    name: v.string(), // Display name (e.g., "Acme Customer Support")
    systemPrompt: v.optional(v.string()), // System prompt text (fallback if no Langfuse)
    model: v.string(), // Model ID (e.g., "gpt-4.1-mini", "gpt-4o")

    // Langfuse configuration (optional)
    langfusePublicKey: v.optional(v.string()),
    langfuseSecretKey: v.optional(v.string()), // TODO: Encrypt in production!
    langfuseHost: v.optional(v.string()),
    langfusePromptName: v.optional(v.string()),
    langfuseLabel: v.optional(v.string()),

    // MCP servers configuration (optional)
    // Stored as JSON string array: [{url, authHeader?, transport?}]
    mcpServers: v.optional(v.string()),

    // Structured output schema (optional)
    // Stored as JSON-serialized Zod schema definition
    outputSchema: v.optional(v.string()),

    createdAt: v.number(), // Unix timestamp
    updatedAt: v.number(), // Unix timestamp
  })
    .index("by_agent_id", ["agentId"]) // Lookup by agent ID (unique)
    .index("by_tenant", ["tenantId"]) // List agents for tenant
    .index("by_org_id", ["orgId"]), // List agents for org

  /**
   * API Keys
   * Tenants generate API keys to authenticate widget requests
   */
  apiKeys: defineTable({
    tenantId: v.id("tenants"), // Reference to tenant
    keyHash: v.string(), // SHA-256 hash of the API key
    keyPrefix: v.string(), // First 8 chars for display (e.g., "sk_live_")
    name: v.string(), // Key name/description
    lastUsedAt: v.optional(v.number()), // Last usage timestamp
    createdAt: v.number(), // Unix timestamp
  })
    .index("by_hash", ["keyHash"]) // Lookup for validation
    .index("by_tenant", ["tenantId"]), // List keys for tenant

  /**
   * Documents
   * Uploaded files for agent knowledge base (RAG)
   */
  documents: defineTable({
    tenantId: v.id("tenants"), // Reference to tenant
    agentId: v.optional(v.id("agents")), // Optional: scope to specific agent
    storageId: v.id("_storage"), // Convex file storage ID
    filename: v.string(), // Original filename
    mimeType: v.string(), // File MIME type
    status: v.string(), // "processing" | "ready" | "failed"
    createdAt: v.number(), // Unix timestamp
  })
    .index("by_tenant", ["tenantId"]) // List docs for tenant
    .index("by_agent", ["agentId"]), // List docs for agent

  /**
   * Embeddings
   * Vector embeddings for RAG knowledgebase
   * Each document is chunked and embedded separately
   */
  embeddings: defineTable({
    documentId: v.id("documents"), // Reference to source document
    tenantId: v.id("tenants"), // Denormalized for efficient filtering
    agentId: v.optional(v.id("agents")), // Optional: scope to specific agent
    chunkIndex: v.number(), // Position in document (0, 1, 2, ...)
    text: v.string(), // Chunk text content
    embedding: v.array(v.float64()), // Vector embedding (e.g., 1536 dimensions)
  })
    .index("by_tenant", ["tenantId"]) // Vector search scoped to tenant
    .index("by_document", ["documentId"]) // Get all chunks for document
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536, // OpenAI text-embedding-3-small
      filterFields: ["tenantId"], // Always filter by tenant for multi-tenant isolation
    }),
});
