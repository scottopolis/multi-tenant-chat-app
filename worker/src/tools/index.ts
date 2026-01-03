import { fileSearchTool } from '@openai/agents';
import { builtinTools } from './builtin';
import { getMCPTools } from '../mcp';
import { getAgentConfig, type AgentConfigEnv } from '../tenants/config';
import { createVectorSearchTool } from './vectorSearch';

/**
 * Tool registry
 * 
 * ✅ MCP Server Integration - Implemented
 * - Connects to agent's MCP servers if configured
 * - Fetches tools from multiple MCP servers
 * - Merges with built-in tools
 * 
 * TODO: Future enhancements
 * - Fetch enabled built-in tools from agent settings (selective tool enabling)
 * - Fetch webhook tool definitions from agent config
 * - Cache tool configurations per agent (with TTL)
 */

export interface GetToolsOptions {
  /** 
   * If true, only returns function tools compatible with RealtimeAgent.
   * Hosted tools (like fileSearchTool) are replaced with function equivalents.
   */
  forVoice?: boolean;
  /**
   * OpenAI API key - required when forVoice is true and agent has a vectorStoreId.
   * Used to query the vector store directly via function tool.
   */
  openaiApiKey?: string;
}

/**
 * Get all available tools for an agent
 * 
 * Combines:
 * 1. Built-in tools (currently empty - examples kept as reference)
 * 2. MCP server tools via HTTP (workaround for Cloudflare Workers)
 * 3. Vector store search (hosted file_search or function tool for voice)
 * 
 * Note: Native MCP support via Agent.mcpServers uses stdio (subprocess spawning)
 * which doesn't work in Cloudflare Workers. We use HTTP-based MCP client instead.
 * 
 * For voice agents (RealtimeAgent), set forVoice: true to get only function tools.
 * Hosted tools like file_search don't work with RealtimeAgent.
 * 
 * @param agentId - Agent identifier
 * @param env - Optional environment bindings (for Convex/DB access)
 * @param options - Optional settings for tool loading
 * @returns Array of tools in OpenAI Agents SDK format
 * 
 * @example
 * // For regular agents
 * const tools = await getTools('acme-support', { CONVEX_URL: env.CONVEX_URL });
 * 
 * // For voice agents
 * const tools = await getTools('acme-support', { CONVEX_URL: env.CONVEX_URL }, { 
 *   forVoice: true, 
 *   openaiApiKey: env.OPENAI_API_KEY 
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
  
  // 4. Add vector store search if agent has a vector store (RAG knowledge base)
  if (config?.vectorStoreId) {
    if (options?.forVoice) {
      // Voice agents (RealtimeAgent) only support function tools, not hosted tools
      // Use our custom function tool that queries the vector store API directly
      if (options.openaiApiKey) {
        tools.push(createVectorSearchTool(config.vectorStoreId, options.openaiApiKey));
      } else {
        console.warn(`[Tools] Voice agent has vectorStoreId but no openaiApiKey provided - skipping knowledge base tool`);
      }
    } else {
      // Regular agents can use the hosted file_search tool
      tools.push(fileSearchTool([config.vectorStoreId]));
    }
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

