import { fileSearchTool } from '@openai/agents';
import { builtinTools } from './builtin';
import { getMCPTools } from '../mcp';
import { getAgentConfig, type AgentConfigEnv } from '../tenants/config';

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

/**
 * Get all available tools for an agent
 * 
 * Combines:
 * 1. Built-in tools (currentTime, calculator, etc.)
 * 2. MCP server tools via HTTP (workaround for Cloudflare Workers)
 * 3. Future: Webhook tools, selective built-in tool filtering
 * 
 * Note: Native MCP support via Agent.mcpServers uses stdio (subprocess spawning)
 * which doesn't work in Cloudflare Workers. We use HTTP-based MCP client instead.
 * 
 * @param agentId - Agent identifier
 * @param env - Optional environment bindings (for Convex/DB access)
 * @returns Array of tools in OpenAI Agents SDK format
 * 
 * @example
 * const tools = await getTools('acme-support', { CONVEX_URL: env.CONVEX_URL });
 * // Returns: [currentTime, calculator, ...mcpTools]
 */
export async function getTools(agentId: string, env?: AgentConfigEnv) {
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
  
  // 4. Add file_search tool if agent has a vector store (RAG knowledge base)
  if (config?.vectorStoreId) {
    tools.push(fileSearchTool([config.vectorStoreId]));
    console.log(`[Tools] Added file_search for vector store: ${config.vectorStoreId}`);
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

