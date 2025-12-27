/**
 * Tenant/Organization Configuration
 * 
 * In production, this would be stored in a database (D1, Convex, etc.)
 * and fetched per request based on the authenticated tenant.
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

export interface TenantConfig {
  /** Unique tenant/org identifier */
  tenantId: string;
  
  /** Display name for the tenant */
  name?: string;
  
  /** 
   * Langfuse configuration
   * If provided, tenant uses their own Langfuse account
   * If not provided, falls back to platform default (from env vars)
   */
  langfuse?: LangfuseConfig;
  
  /** 
   * Default model to use for this tenant
   * Defaults to 'gpt-4.1-mini' if not specified
   */
  model?: string;
  
  /**
   * MCP Server configuration
   * Connects to external tool server for custom tools
   */
  mcpServer?: MCPServerConfig;
  
  // Future additions:
  // webhookTools?: WebhookToolConfig[];
  // enabledBuiltinTools?: string[];
  // rateLimits?: RateLimitConfig;
  // corsOrigins?: string[];
}

