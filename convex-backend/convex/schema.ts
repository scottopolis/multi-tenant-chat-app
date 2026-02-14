import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Multi-Tenant Chat Assistant Database Schema
 *
 * This schema supports:
 * - Multi-tenant isolation via tenantId
 * - Agent configurations with Langfuse integration
 * - API key management
 * - RAG knowledge base via Convex RAG component (documents table)
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

    // Security: Domain allowlist for widget embedding
    // Supports wildcards: ["example.com", "*.example.org"]
    // Default ["*"] allows all domains
    allowedDomains: v.optional(v.array(v.string())),

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
    scopes: v.optional(v.array(v.string())), // ["widget:chat"] - limit what key can do
    lastUsedAt: v.optional(v.number()), // Last usage timestamp
    revokedAt: v.optional(v.number()), // Revocation timestamp (null = active)
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
    sttProvider: v.optional(v.string()), // "deepgram"
    ttsProvider: v.optional(v.string()), // "deepgram"
    sttModel: v.optional(v.string()), // "nova-3" / "nova-3-multilingual"
    ttsModel: v.optional(v.string()), // "aura-2"
    ttsVoice: v.optional(v.string()), // TTS voice persona
    locale: v.optional(v.string()), // "en-US"
    bargeInEnabled: v.optional(v.boolean()), // Allow interruptions
    enabled: v.optional(v.boolean()),
    // Legacy OpenAI Realtime fields (backward compatibility)
    voiceModel: v.optional(v.string()),
    voiceName: v.optional(v.string()),
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
   * Documents (Knowledge Base Files)
   * Files uploaded to the RAG knowledge base for each agent.
   * Stored in Convex file storage with text extracted and indexed via RAG component.
   */
  documents: defineTable({
    tenantId: v.id("tenants"),
    agentId: v.id("agents"),
    fileName: v.string(),
    fileSize: v.number(), // bytes
    storageId: v.id("_storage"), // Convex file storage reference
    mimeType: v.string(), // e.g., "text/plain", "text/markdown"
    status: v.union(
      v.literal("pending"), // Upload complete, awaiting processing
      v.literal("processing"), // Being chunked and indexed
      v.literal("ready"), // Successfully indexed in RAG
      v.literal("failed") // Processing failed
    ),
    errorMessage: v.optional(v.string()), // Error details if failed
    createdAt: v.number(),
  })
    .index("by_agent", ["agentId"])
    .index("by_tenant", ["tenantId"]),

  /**
   * Conversations
   * Chat conversations with embedded events for message history.
   * Uses single-table design: events stored as array within conversation document.
   */
  conversations: defineTable({
    // Multi-tenant isolation
    tenantId: v.id("tenants"),
    agentId: v.id("agents"),
    orgId: v.optional(v.string()), // Denormalized for convenience

    // Ownership
    userId: v.optional(v.string()), // Clerk user ID (null for anonymous)
    sessionId: v.string(), // Always present, from localStorage

    // Display / UX
    title: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("active"), v.literal("archived"))
    ),

    // Provider-level conversation tracking
    providerConversationId: v.optional(v.string()), // e.g. OpenAI conversationId
    lastResponseId: v.optional(v.string()), // Last provider response ID

    // Client context (captured at creation, for analytics & prompt injection)
    context: v.optional(
      v.object({
        pageUrl: v.optional(v.string()),
        referrer: v.optional(v.string()),
        userAgent: v.optional(v.string()),
        locale: v.optional(v.string()),
        timezone: v.optional(v.string()),
        customMetadata: v.optional(v.any()),
      })
    ),

    // Events array - all conversation events stored here
    events: v.array(
      v.object({
        seq: v.number(), // Monotonic sequence for ordering
        eventType: v.union(
          v.literal("message"),
          v.literal("tool_call"),
          v.literal("tool_result"),
          v.literal("system"),
          v.literal("error")
        ),

        // Message fields
        role: v.optional(
          v.union(
            v.literal("user"),
            v.literal("assistant"),
            v.literal("system"),
            v.literal("tool")
          )
        ),
        content: v.optional(v.string()),

        // Provider info
        model: v.optional(v.string()),
        providerResponseId: v.optional(v.string()),

        // Tool fields
        toolName: v.optional(v.string()),
        toolCallId: v.optional(v.string()),
        toolInput: v.optional(v.any()),
        toolResult: v.optional(v.any()),

        // Error fields
        errorType: v.optional(v.string()),
        errorMessage: v.optional(v.string()),

        // Unstructured metadata for this event
        metadata: v.optional(v.any()),

        createdAt: v.number(),
      })
    ),

    // Unstructured metadata for the conversation
    metadata: v.optional(v.any()),

    createdAt: v.number(),
    updatedAt: v.number(),
    lastEventAt: v.number(),
  })
    .index("by_agent_lastEvent", ["agentId", "lastEventAt"])
    .index("by_tenant_lastEvent", ["tenantId", "lastEventAt"])
    .index("by_session", ["tenantId", "agentId", "sessionId", "lastEventAt"])
    .index("by_user", ["tenantId", "agentId", "userId", "lastEventAt"]),

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
    sttUsageSec: v.optional(v.number()),
    ttsCharacters: v.optional(v.number()),
    deepgramCostUsd: v.optional(v.number()),
  })
    .index("by_tenant", ["tenantId", "startedAt"])
    .index("by_agent", ["agentId", "startedAt"])
    .index("by_callSid", ["twilioCallSid"]),
});
