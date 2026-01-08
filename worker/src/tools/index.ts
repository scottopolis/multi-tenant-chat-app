import { builtinTools } from './builtin';
import { getMCPTools } from '../mcp';
import { getAgentConfig, type AgentConfigEnv } from '../tenants/config';
import { createKnowledgeBaseSearchTool, createKnowledgeBaseSearchToolTanStack } from './vectorSearch';

/**
 * Tool registry
 *
 * ✅ MCP Server Integration - Implemented
 * - Connects to agent's MCP servers if configured
 * - Fetches tools from multiple MCP servers
 * - Merges with built-in tools
 *
 * ✅ Knowledge Base Search - Convex RAG
 * - Uses Convex RAG component for vector search
 * - Unified search tool for both chat and voice agents
 *
 * TODO: Future enhancements
 * - Fetch enabled built-in tools from agent settings (selective tool enabling)
 * - Fetch webhook tool definitions from agent config
 * - Cache tool configurations per agent (with TTL)
 */

export interface GetToolsOptions {
  /**
   * Convex URL - required for knowledge base search
   */
  convexUrl?: string;
}

/**
 * Get all available tools for an agent
 *
 * Combines:
 * 1. Built-in tools (currently empty - examples kept as reference)
 * 2. MCP server tools via HTTP (workaround for Cloudflare Workers)
 * 3. Knowledge base search via Convex RAG (unified for chat and voice)
 *
 * Note: Native MCP support via Agent.mcpServers uses stdio (subprocess spawning)
 * which doesn't work in Cloudflare Workers. We use HTTP-based MCP client instead.
 *
 * @param agentId - Agent identifier
 * @param env - Optional environment bindings (for Convex/DB access)
 * @param options - Optional settings for tool loading
 * @returns Array of tools in OpenAI Agents SDK format
 *
 * @example
 * const tools = await getTools('acme-support', { CONVEX_URL: env.CONVEX_URL }, {
 *   convexUrl: env.CONVEX_URL
 * });
 */
export async function getTools(agentId: string, env?: AgentConfigEnv, options?: GetToolsOptions) {
  // 1. Get agent configuration (pass env for Convex access)
  const config = await getAgentConfig(agentId, env);

  // 2. Start with built-in tools (now an array)
  const tools: any[] = [...builtinTools];

  // 3. Add MCP tools if configured (HTTP-based for Workers compatibility)
  // Note: We can't use Agent.mcpServers because it requires stdio/subprocess
  // which doesn't work in Cloudflare Workers sandboxed environment
  if (config?.mcpServers && config.mcpServers.length > 0) {
    // Fetch tools from each MCP server
    for (const mcpServer of config.mcpServers) {
      if (!mcpServer.url) {
        console.warn(`[Tools] Skipping MCP server with missing URL for agent: ${agentId}`);
        continue;
      }

      try {
        const mcpTools = await getMCPTools({
          serverUrl: mcpServer.url,
          authHeader: mcpServer.authHeader,
          transport: mcpServer.transport || 'http',
        });

        // getMCPTools now returns an array directly
        tools.push(...mcpTools);
      } catch (error) {
        console.error(`[Tools] Failed to fetch tools from ${mcpServer.url}:`, error);
        // Continue with other servers even if one fails
      }
    }
  }

  // 4. Add knowledge base search if agent has documents and convexUrl is provided
  // Uses Convex RAG - unified for both chat and voice agents
  if (config?.agentConvexId && options?.convexUrl) {
    tools.push(createKnowledgeBaseSearchTool(config.agentConvexId, options.convexUrl));
  }

  // TODO: Add webhook tools here
  // if (config?.webhookTools) {
  //   const webhookTools = await createWebhookTools(config.webhookTools);
  //   tools.push(...webhookTools);
  // }

  return tools;
}

export type { WebhookToolConfig } from './webhook';
export { createWebhookTool } from './webhook';
export { builtinTools } from './builtin';

/**
 * Get all available TanStack AI tools for an agent
 *
 * This is the TanStack AI equivalent of getTools() for use with the new runtime.
 * Currently only includes knowledge base search; MCP tools will be added later.
 *
 * @param agentId - Agent identifier
 * @param env - Optional environment bindings (for Convex/DB access)
 * @param options - Optional settings for tool loading
 * @returns Array of TanStack AI tools
 */
export async function getAiTools(agentId: string, env?: AgentConfigEnv, options?: GetToolsOptions) {
  const config = await getAgentConfig(agentId, env);
  const tools: ReturnType<typeof createKnowledgeBaseSearchToolTanStack>[] = [];

  // Add knowledge base search if agent has documents and convexUrl is provided
  if (config?.agentConvexId && options?.convexUrl) {
    tools.push(createKnowledgeBaseSearchToolTanStack(config.agentConvexId, options.convexUrl));
  }

  // TODO: Add MCP tools for TanStack path
  // TODO: Add webhook tools for TanStack path

  return tools;
}
