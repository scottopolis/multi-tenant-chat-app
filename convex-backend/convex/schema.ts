import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Multi-Tenant Chat Assistant Database Schema
 *
 * This schema supports:
 * - Multi-tenant isolation via tenantId
 * - Agent configurations with Langfuse integration
 * - API key management
 * - RAG knowledgebase via OpenAI Vector Stores (vectorStoreId in agents)
 *
 * Security: All queries MUST filter by tenantId to prevent cross-tenant data access
 */

export default defineSchema({
  /**
   * Tenants (Users or Organizations)
   * Each tenant represents a customer using the platform
   * Currently uses clerkUserId for personal accounts
   * Can be extended to support clerkOrgId for team accounts later
   */
  tenants: defineTable({
    clerkUserId: v.optional(v.string()), // Clerk user ID (for personal accounts)
    clerkOrgId: v.optional(v.string()), // Clerk org ID (for future team support)
    name: v.string(), // Display name
    plan: v.string(), // Billing tier: "free" | "pro" | "enterprise"
    createdAt: v.number(), // Unix timestamp
  })
    .index("by_clerk_user", ["clerkUserId"]) // Lookup by Clerk user ID
    .index("by_clerk_org", ["clerkOrgId"]), // Lookup by Clerk org ID (future)

  /**
   * Agents
   * Each agent is a configured chatbot instance with specific behavior
   * Agents belong to tenants and have their own settings
   */
  agents: defineTable({
    agentId: v.string(), // Unique agent identifier (e.g., "acme-support")
    tenantId: v.id("tenants"), // Reference to tenant
    orgId: v.optional(v.string()), // Denormalized org identifier for easier queries
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

    // OpenAI Vector Store for RAG knowledgebase (optional)
    vectorStoreId: v.optional(v.string()), // OpenAI Vector Store ID

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
   * Voice Agents
   * Per-agent voice configuration. Extends existing agents with voice capabilities.
   */
  voiceAgents: defineTable({
    tenantId: v.id("tenants"),
    agentId: v.id("agents"),
    voiceModel: v.string(), // "gpt-4o-realtime-preview"
    voiceName: v.optional(v.string()), // TTS voice persona: "verse", "alloy", etc.
    locale: v.string(), // "en-US"
    bargeInEnabled: v.boolean(), // Allow interruptions
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_tenant", ["tenantId"]),

  /**
   * Twilio Numbers
   * Maps Twilio phone numbers to voice agents.
   */
  twilioNumbers: defineTable({
    tenantId: v.id("tenants"),
    agentId: v.id("agents"),
    voiceAgentId: v.id("voiceAgents"),
    phoneNumber: v.string(), // E.164: "+15551234567"
    description: v.optional(v.string()),
    twilioSid: v.optional(v.string()), // Twilio IncomingPhoneNumber SID
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_phone", ["phoneNumber"]) // unique lookup
    .index("by_agent", ["agentId"]),

  /**
   * Voice Calls
   * Call logs for analytics and billing.
   */
  voiceCalls: defineTable({
    tenantId: v.id("tenants"),
    agentId: v.id("agents"),
    voiceAgentId: v.id("voiceAgents"),
    twilioNumberId: v.id("twilioNumbers"),
    twilioCallSid: v.string(),
    fromNumber: v.string(),
    toNumber: v.string(),
    status: v.union(
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("failed")
    ),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    durationSec: v.optional(v.number()),
    // Usage tracking
    openaiInputTokens: v.optional(v.number()),
    openaiOutputTokens: v.optional(v.number()),
    openaiCostUsd: v.optional(v.number()),
    twilioDurationSec: v.optional(v.number()),
    twilioCostUsd: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId", "startedAt"])
    .index("by_agent", ["agentId", "startedAt"])
    .index("by_callSid", ["twilioCallSid"]),
});
