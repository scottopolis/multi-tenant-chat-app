import type { AgentConfig } from './types';
import { JSONSchemaToZod } from '@dmitryrechkin/json-schema-to-zod';

/**
 * Agent Configuration Storage
 * 
 * Production: Fetch from Convex database
 * 
 * Architecture:
 * - Each agent belongs to an organization (orgId)
 * - One org can have multiple agents with different configs
 * - Agents are identified by unique agentId
 */

/**
 * Environment bindings for agent config
 */
export interface AgentConfigEnv {
  CONVEX_URL?: string; // Convex deployment URL for agent configs
}

/**
 * In-memory cache for agent configs
 * Reduces DB queries in production
 */
const configCache = new Map<string, { config: AgentConfig; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Default fallback config when agent not found
 */
const DEFAULT_FALLBACK: AgentConfig = {
  agentId: 'default',
  orgId: 'unknown',
  name: 'Default Assistant',
  model: 'gpt-4.1-mini',
};

/**
 * Get agent configuration
 * 
 * @param agentId - Agent identifier
 * @param env - Environment bindings (must include CONVEX_URL for production)
 * @returns Agent configuration or default fallback if not found
 * 
 * @example
 * const config = await getAgentConfig('acme-support', { CONVEX_URL: env.CONVEX_URL });
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

  if (env?.CONVEX_URL) {
    try {
      config = await fetchFromConvex(agentId, env.CONVEX_URL);
      console.log(`[AgentConfig] Loaded from Convex: ${agentId}`);
    } catch (error) {
      console.error(`[AgentConfig] Convex fetch failed for ${agentId}:`, error);
      config = { ...DEFAULT_FALLBACK, agentId };
    }
  } else {
    console.warn(`[AgentConfig] CONVEX_URL not set, using fallback for: ${agentId}`);
    config = { ...DEFAULT_FALLBACK, agentId };
  }

  // Cache the config
  configCache.set(agentId, { config, timestamp: Date.now() });

  return config;
}

/**
 * Fetch agent config from Convex
 * Uses the public HTTP endpoint to bypass Clerk auth
 *
 * @internal
 */
async function fetchFromConvex(
  agentId: string,
  convexUrl: string
): Promise<AgentConfig> {
  // Use the public HTTP endpoint instead of the query API
  // This bypasses Clerk auth requirements
  const response = await fetch(`${convexUrl}/api/agents/${encodeURIComponent(agentId)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Convex HTTP fetch failed: ${response.status}`);
  }

  const result = await response.json() as any;

  if (!result) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  // Convert JSON Schema to Zod schema if present
  let outputSchema;
  if (result.outputSchema) {
    try {
      // Parse if it's a string, otherwise use as-is
      const schemaObj = typeof result.outputSchema === 'string' 
        ? JSON.parse(result.outputSchema) 
        : result.outputSchema;
      
      if (schemaObj && typeof schemaObj === 'object' && Object.keys(schemaObj).length > 0) {
        outputSchema = JSONSchemaToZod.convert(schemaObj);
        console.log(`[AgentConfig] Converted outputSchema for ${agentId}:`, (outputSchema?._def as any)?.typeName);
      }
    } catch (error) {
      console.error(`[AgentConfig] Failed to convert outputSchema for ${agentId}:`, error);
    }
  }

  return {
    agentId: result.agentId,
    orgId: result.orgId,
    name: result.name,
    systemPrompt: result.systemPrompt,
    langfuse: result.langfuse,
    model: result.model,
    mcpServers: result.mcpServers,
    outputSchema,
    agentConvexId: result._id,
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
 * List all configured agents for an org
 * @param env - Environment bindings
 * @param orgId - Organization ID to filter by
 */
export async function listAgents(env?: AgentConfigEnv, orgId?: string): Promise<string[]> {
  if (!env?.CONVEX_URL) {
    console.warn('[AgentConfig] CONVEX_URL not set, cannot list agents');
    return [];
  }

  try {
    const response = await fetch(`${env.CONVEX_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: orgId ? 'agents:listByOrgId' : 'agents:listByOrgId',
        args: orgId ? { orgId } : {},
      }),
    });

    if (!response.ok) {
      throw new Error(`Convex query failed: ${response.status}`);
    }

    const data = await response.json() as { value: any[] };
    return (data.value || []).map((agent: any) => agent.agentId);
  } catch (error) {
    console.error('[AgentConfig] Failed to list agents:', error);
    return [];
  }
}

/**
 * Check if an agent exists
 */
export async function agentExists(
  agentId: string,
  env?: AgentConfigEnv
): Promise<boolean> {
  if (!env?.CONVEX_URL) {
    return false;
  }

  try {
    const config = await fetchFromConvex(agentId, env.CONVEX_URL);
    return !!config;
  } catch {
    return false;
  }
}

// Backward compatibility aliases (deprecated)
/** @deprecated Use getAgentConfig instead */
export const getTenantConfig = getAgentConfig;
/** @deprecated Use invalidateAgentCache instead */
export const invalidateTenantCache = invalidateAgentCache;
/** @deprecated Use listAgents instead */
export const listTenants = listAgents;
/** @deprecated Use agentExists instead */
export const tenantExists = agentExists;
