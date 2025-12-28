import type { AgentConfig } from './types';
import { z } from 'zod';

/**
 * Agent Configuration Storage
 * 
 * MVP: Hardcoded configs for testing
 * Production: Fetch from database (D1, Convex, etc.)
 * 
 * Architecture:
 * - Each agent belongs to an organization (orgId)
 * - One org can have multiple agents with different configs
 * - Agents are identified by unique agentId
 * 
 * This is where you'd store:
 * - Agent-specific Langfuse keys
 * - MCP server configurations per agent
 * - Model preferences per agent
 * - System prompts per agent
 */

/**
 * Environment bindings for agent config
 * Includes DB binding for production use
 */
export interface AgentConfigEnv {
  DB?: D1Database; // D1 database binding (production)
  // Add other bindings as needed (KV, Durable Objects, etc.)
}

/**
 * In-memory cache for agent configs
 * Reduces DB queries in production
 */
const configCache = new Map<string, { config: AgentConfig; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// MVP: Hardcoded agent configurations
// TODO: Replace with database queries
const AGENT_CONFIGS: Record<string, AgentConfig> = {
  /**
   * Default agent - general purpose assistant
   * Belongs to the platform organization
   */
  'default': {
    agentId: 'default',
    orgId: 'platform',
    name: 'Default Assistant',
    model: 'gpt-4.1-mini',
    langfuse: {
        publicKey: 'pk-lf-484a26a9-19d2-4b0c-be61-42821f6fca56',
        secretKey: 'sk-lf-f75218f3-7d55-45ec-ab41-4d9a9c927a2a',
        host: 'https://us.cloud.langfuse.com',
        promptName: 'pirate', // Their custom prompt
      },
    // MCP servers configuration (optional)
    // NOTE: Don't configure an agent to connect to its own MCP endpoint!
    // That creates an infinite loop. Point to external MCP servers instead.
    // Example for external MCP servers:
    mcpServers: [
      {
        url: 'http://localhost:3030',
        transport: 'http',
      },
    ],
    outputSchema: z.object({
      response: z.string(),
      suggestions: z.array(z.string()).describe('2-3 very short suggested follow-up actions or questions the user might want to ask'),
    }),
  },
  
  /**
   * Example: Acme Corp - Customer Support Agent
   * Manages their own prompts in Langfuse and has custom MCP tools
   */
  'acme-support': {
    agentId: 'acme-support',
    orgId: 'acme-corp',
    name: 'Acme Customer Support',
    langfuse: {
      publicKey: 'pk-lf-484a26a9-19d2-4b0c-be61-42821f6fca56',
      secretKey: 'sk-lf-f75218f3-7d55-45ec-ab41-4d9a9c927a2a',
      host: 'https://us.cloud.langfuse.com',
      promptName: 'customer-support', // Their custom prompt
    },
    model: 'gpt-4.1-mini',
    // MCP servers configuration (example - replace with real servers)
    // Uncomment and configure when you have MCP servers running:
    // You can have multiple MCP servers providing different tools
    // mcpServers: [
    //   {
    //     url: 'http://localhost:3001/mcp',
    //     authHeader: 'Bearer acme-corp-mcp-key',
    //     transport: 'http',
    //   },
    //   {
    //     url: 'http://localhost:3002/mcp',
    //     transport: 'http',
    //   },
    // ],
  },
  
  /**
   * Example: Acme Corp - Sales Agent
   * Same org, different agent with different configuration
   */
  'acme-sales': {
    agentId: 'acme-sales',
    orgId: 'acme-corp',
    name: 'Acme Sales Assistant',
    langfuse: {
      publicKey: 'pk-lf-484a26a9-19d2-4b0c-be61-42821f6fca56',
      secretKey: 'sk-lf-f75218f3-7d55-45ec-ab41-4d9a9c927a2a',
      host: 'https://us.cloud.langfuse.com',
      promptName: 'sales-assistant', // Different prompt
    },
    model: 'claude-3.5-sonnet', // Different model
  },
  
  /**
   * Example: Contoso - General Agent
   * Uses platform Langfuse with custom prompt
   */
  'contoso-general': {
    agentId: 'contoso-general',
    orgId: 'contoso-ltd',
    name: 'Contoso Assistant',
    langfuse: {
      // These would be the platform's keys in production
      // or you could omit this entirely and use platform default
      publicKey: 'PLATFORM_KEY', // Special marker to use platform keys
      secretKey: 'PLATFORM_KEY',
      promptName: 'general-assistant',
      label: 'contoso', // Use labeled version in platform's Langfuse
    },
    model: 'claude-3.5-sonnet',
  },
  
  /**
   * Example: Simple Bot - Shopping Agent
   * Uses systemPrompt (no Langfuse) + MCP server
   * Shows agent using MCP without Langfuse
   */
  'simplebot-shopping': {
    agentId: 'simplebot-shopping',
    orgId: 'simplebot-inc',
    name: 'Simple Bot Shopping Assistant',
    systemPrompt: `You are a helpful shopping assistant for Simple Bot Inc. 
    
You help customers find products, answer questions about availability, and provide recommendations.

Be friendly, concise, and always try to upsell related products when appropriate.

If asked about orders or shipping, politely inform the customer to contact support directly.`,
    model: 'gpt-4.1-mini',
    // No Langfuse config - uses systemPrompt instead
    
    // Example MCP servers configuration
    // Uncomment and configure when you have MCP servers running:
    // mcpServers: [
    //   {
    //     url: 'http://localhost:3002/mcp',
    //     authHeader: 'Bearer simplebot-secret',
    //     transport: 'http',
    //   },
    // ],
  },
  
  /**
   * Example: Calendar Event Extractor
   * Demonstrates structured output - returns parsed calendar events
   * Shows agent with outputSchema for structured responses
   */
  'calendar-extractor': {
    agentId: 'calendar-extractor',
    orgId: 'platform',
    name: 'Calendar Event Extractor',
    systemPrompt: 'Extract calendar events from the supplied text. Parse dates, times, participants, and event details.',
    model: 'gpt-4.1-mini',
    // Structured output schema - agent returns this format instead of text
    outputSchema: z.object({
      events: z.array(
        z.object({
          name: z.string().describe('Event name or title'),
          date: z.string().describe('Event date in ISO format'),
          time: z.string().nullable().optional().describe('Event time if specified'),
          participants: z.array(z.string()).describe('List of participants or attendees'),
          location: z.string().nullable().optional().describe('Event location if specified'),
          description: z.string().nullable().optional().describe('Additional event details'),
        })
      ),
    }),
  },
  
  /**
   * Example: Support Bot with Suggestions
   * Demonstrates structured output with quick-reply suggestions
   * Shows agent that guides user through conversation with clickable options
   */
  'support-bot': {
    agentId: 'support-bot',
    orgId: 'platform',
    name: 'Support Assistant',
    systemPrompt: `You are a helpful customer support assistant.

Always provide your response in a friendly, concise manner, and include 2-4 relevant suggestions for what the user might want to do next.

Use the 'response' field for your main answer, and 'suggestions' field for quick-reply options.`,
    model: 'gpt-4.1-mini',
    // Structured output with suggestions for guided conversation
    outputSchema: z.object({
      response: z.string().describe('Your helpful response to the user'),
      suggestions: z.array(z.string()).describe('2-3 suggested follow-up actions or questions the user might want to ask'),
    }),
  },
};

/**
 * Get agent configuration
 * 
 * @param agentId - Agent identifier
 * @param env - Optional environment bindings (for DB access in production)
 * @returns Agent configuration or default config if not found
 * 
 * @example MVP (current)
 * const config = await getAgentConfig('acme-support');
 * 
 * @example Production (with DB)
 * const config = await getAgentConfig('acme-support', { DB: env.DB });
 */
export async function getAgentConfig(
  agentId: string,
  env?: AgentConfigEnv
): Promise<AgentConfig> {
  // Check cache first
  const cached = configCache.get(agentId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.config;
  }

  let config: AgentConfig;

  // Production: Fetch from database if DB binding exists
  if (env?.DB) {
    try {
      config = await fetchFromDatabase(agentId, env.DB);
      console.log(`[AgentConfig] Loaded from DB: ${agentId}`);
    } catch (error) {
      console.error(`[AgentConfig] DB fetch failed for ${agentId}:`, error);
      config = AGENT_CONFIGS[agentId] || AGENT_CONFIGS['default'];
    }
  } else {
    // MVP: Use hardcoded configs
    config = AGENT_CONFIGS[agentId] || AGENT_CONFIGS['default'];
    console.log(`[AgentConfig] Loaded from memory: ${agentId}`);
  }

  // Cache the config
  configCache.set(agentId, { config, timestamp: Date.now() });

  return config;
}

// Backward compatibility alias (deprecated)
/** @deprecated Use getAgentConfig instead */
export const getTenantConfig = getAgentConfig;

/**
 * Fetch agent config from D1 database
 * 
 * @internal
 */
async function fetchFromDatabase(
  agentId: string,
  db: D1Database
): Promise<AgentConfig> {
  const result = await db
    .prepare(
      `SELECT 
        agent_id,
        org_id,
        name,
        system_prompt,
        langfuse_public_key,
        langfuse_secret_key,
        langfuse_host,
        langfuse_prompt_name,
        langfuse_label,
        model
      FROM agent_configs 
      WHERE agent_id = ?`
    )
    .bind(agentId)
    .first();

  if (!result) {
    return AGENT_CONFIGS['default'];
  }

  // Parse DB result into AgentConfig
  return {
    agentId: result.agent_id as string,
    orgId: result.org_id as string,
    name: result.name as string | undefined,
    systemPrompt: result.system_prompt as string | undefined,
    langfuse: result.langfuse_public_key
      ? {
          publicKey: result.langfuse_public_key as string,
          secretKey: result.langfuse_secret_key as string, // TODO: Decrypt!
          host: result.langfuse_host as string | undefined,
          promptName: result.langfuse_prompt_name as string | undefined,
          label: result.langfuse_label as string | undefined,
        }
      : undefined,
    model: result.model as string | undefined,
  };
}

/**
 * Invalidate cached config for an agent
 * Call this when agent config is updated
 * 
 * @param agentId - Agent ID to invalidate, or undefined to clear all
 */
export function invalidateAgentCache(agentId?: string): void {
  if (agentId) {
    configCache.delete(agentId);
    console.log(`[AgentConfig] Invalidated cache for: ${agentId}`);
  } else {
    configCache.clear();
    console.log(`[AgentConfig] Cleared all cache`);
  }
}

/**
 * List all configured agents (for testing/debugging)
 * In production, this would query the database
 * 
 * @param orgId - Optional: Filter agents by organization
 */
export async function listAgents(env?: AgentConfigEnv, orgId?: string): Promise<string[]> {
  if (env?.DB) {
    try {
      const query = orgId
        ? 'SELECT agent_id FROM agent_configs WHERE org_id = ? ORDER BY agent_id'
        : 'SELECT agent_id FROM agent_configs ORDER BY agent_id';
      
      const stmt = orgId 
        ? env.DB.prepare(query).bind(orgId)
        : env.DB.prepare(query);
      
      const result = await stmt.all();
      return result.results.map((row: any) => row.agent_id as string);
    } catch (error) {
      console.error('[AgentConfig] Failed to list agents from DB:', error);
    }
  }
  
  // Filter by orgId if provided
  const allAgents = Object.values(AGENT_CONFIGS);
  if (orgId) {
    return allAgents
      .filter(config => config.orgId === orgId)
      .map(config => config.agentId);
  }
  
  return Object.keys(AGENT_CONFIGS);
}

/**
 * Check if an agent exists
 */
export async function agentExists(
  agentId: string,
  env?: AgentConfigEnv
): Promise<boolean> {
  if (env?.DB) {
    try {
      const result = await env.DB.prepare(
        'SELECT 1 FROM agent_configs WHERE agent_id = ?'
      )
        .bind(agentId)
        .first();
      return !!result;
    } catch (error) {
      console.error('[AgentConfig] Failed to check agent existence:', error);
    }
  }
  return agentId in AGENT_CONFIGS;
}

// Backward compatibility aliases (deprecated)
/** @deprecated Use invalidateAgentCache instead */
export const invalidateTenantCache = invalidateAgentCache;
/** @deprecated Use listAgents instead */
export const listTenants = listAgents;
/** @deprecated Use agentExists instead */
export const tenantExists = agentExists;


