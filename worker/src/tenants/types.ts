/**
 * Agent Configuration
 * 
 * In production, this would be stored in a database (D1, Convex, etc.)
 * and fetched per request based on the agentId.
 * 
 * Architecture:
 * - orgId: Organization/tenant (e.g., 'acme-corp')
 * - agentId: Specific agent within org (e.g., 'customer-support', 'sales-assistant')
 * - One org can have multiple agents with different configurations
 */

export interface LangfuseConfig {
  /** Langfuse public key (pk-lf-xxx) */
  publicKey: string;
  /** Langfuse secret key (sk-lf-xxx) */
  secretKey: string;
  /** Langfuse host URL (defaults to cloud.langfuse.com) */
  host?: string;
  /** Name of the prompt to fetch (defaults to 'base-assistant') */
  promptName?: string;
  /** Optional: Label to use when fetching prompt */
  label?: string;
}

export interface MCPServerConfig {
  /** MCP server URL */
  url: string;
  /** Optional auth header for MCP server */
  authHeader?: string;
  /** Transport type (http or sse) */
  transport?: 'http' | 'sse';
}

export interface AgentConfig {
  /** Unique agent identifier */
  agentId: string;
  
  /** Organization/tenant this agent belongs to */
  orgId: string;
  
  /** Display name for the agent */
  name?: string;
  
  /** 
   * System prompt for the agent
   * If provided, used as fallback when Langfuse is not available
   * If not provided, falls back to default system prompt
   * 
   * Priority: Langfuse → systemPrompt → default
   */
  systemPrompt?: string;
  
  /** 
   * Langfuse configuration (optional)
   * If provided, agent uses their own Langfuse account
   * If not provided, falls back to agent's systemPrompt or platform default
   */
  langfuse?: LangfuseConfig;
  
  /** 
   * Default model to use for this agent
   * Defaults to 'gpt-4.1-mini' if not specified
   */
  model?: string;
  
  /**
   * MCP Server configurations
   * Connects to multiple external tool servers for custom tools
   * Each server can provide different sets of tools
   */
  mcpServers?: MCPServerConfig[];
  
  /**
   * Output schema for structured responses (Zod schema)
   * When provided, the agent will return structured data matching this schema
   * instead of plain text responses
   * 
   * @example
   * import { z } from 'zod';
   * const CalendarEvent = z.object({
   *   name: z.string(),
   *   date: z.string(),
   *   participants: z.array(z.string()),
   * });
   * 
   * outputSchema: CalendarEvent
   */
  outputSchema?: any; // Zod schema type
  
  /**
   * Convex document ID for the agent (_id from agents table)
   * Used for knowledge base search via Convex RAG
   */
  agentConvexId?: string;

  /**
   * Tenant ID that owns this agent (Convex document ID)
   * Used for API key tenant binding verification
   */
  tenantId?: string;

  /**
   * Allowed domains for CORS and origin validation
   * Defaults to ["*"] (allow all) if not specified
   */
  allowedDomains?: string[];
  
  // Future additions:
  // webhookTools?: WebhookToolConfig[];
  // enabledBuiltinTools?: string[];
  // rateLimits?: RateLimitConfig;
  // corsOrigins?: string[];
}

// Backward compatibility alias (deprecated)
/** @deprecated Use AgentConfig instead */
export type TenantConfig = AgentConfig;

