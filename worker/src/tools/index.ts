import { builtinTools } from './builtin';
import { getMCPTools } from '../mcp';
import { getAgentConfig } from '../tenants/config';

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
 * 2. MCP server tools (if agent has MCP servers configured)
 * 3. Future: Webhook tools, selective built-in tool filtering
 * 
 * @param agentId - Agent identifier
 * @returns Record of all available tools in AI SDK format
 * 
 * @example
 * const tools = await getTools('acme-support');
 * // Returns: { currentTime, calculator, ...mcpTools }
 */
export async function getTools(agentId: string) {
  // 1. Get agent configuration
  const config = await getAgentConfig(agentId);
  
  // 2. Start with built-in tools
  const tools: Record<string, any> = { ...builtinTools };
  
  // 3. Add MCP tools if configured
  if (config?.mcpServers && config.mcpServers.length > 0) {
    console.log(`[Tools] Fetching MCP tools from ${config.mcpServers.length} server(s) for agent: ${agentId}`);
    
    // Fetch tools from each MCP server
    for (const mcpServer of config.mcpServers) {
      if (!mcpServer.url) {
        console.warn(`[Tools] Skipping MCP server with missing URL for agent: ${agentId}`);
        continue;
      }
      
      try {
        console.log(`[Tools] Connecting to MCP server: ${mcpServer.url}`);
        const mcpTools = await getMCPTools({
          serverUrl: mcpServer.url,
          authHeader: mcpServer.authHeader,
          transport: mcpServer.transport || 'http',
        });
        
        // Merge MCP tools (later servers can override earlier ones and built-in tools)
        Object.assign(tools, mcpTools);
        
        const mcpToolCount = Object.keys(mcpTools).length;
        console.log(`[Tools] Added ${mcpToolCount} tools from ${mcpServer.url}`);
      } catch (error) {
        console.error(`[Tools] Failed to fetch tools from ${mcpServer.url}:`, error);
        // Continue with other servers even if one fails
      }
    }
  } else {
    console.log(`[Tools] No MCP servers configured for agent: ${agentId}`);
  }
  
  // TODO: Add webhook tools here
  // if (config?.webhookTools) {
  //   const webhookTools = await createWebhookTools(config.webhookTools);
  //   Object.assign(tools, webhookTools);
  // }
  
  const totalToolCount = Object.keys(tools).length;
  console.log(`[Tools] Total tools available for agent ${agentId}: ${totalToolCount}`);
  
  return tools;
}

export type { WebhookToolConfig } from './webhook';
export { createWebhookTool } from './webhook';
export { builtinTools } from './builtin';

