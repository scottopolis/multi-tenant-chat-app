import { builtinTools } from './builtin';
import { getMCPTools } from '../mcp';
import { getTenantConfig } from '../tenants/config';

/**
 * Tool registry
 * 
 * ✅ MCP Server Integration - Implemented
 * - Connects to tenant's MCP servers if configured
 * - Fetches tools from multiple MCP servers
 * - Merges with built-in tools
 * 
 * TODO: Future enhancements
 * - Fetch enabled built-in tools from org settings (selective tool enabling)
 * - Fetch webhook tool definitions from org config
 * - Cache tool configurations per org (with TTL)
 */

/**
 * Get all available tools for an organization
 * 
 * Combines:
 * 1. Built-in tools (currentTime, calculator, etc.)
 * 2. MCP server tools (if tenant has MCP servers configured)
 * 3. Future: Webhook tools, selective built-in tool filtering
 * 
 * @param orgId - Organization/tenant identifier
 * @returns Record of all available tools in AI SDK format
 * 
 * @example
 * const tools = await getTools('tenant-1');
 * // Returns: { currentTime, calculator, ...mcpTools }
 */
export async function getTools(orgId: string) {
  // 1. Get tenant configuration
  const config = await getTenantConfig(orgId);
  
  // 2. Start with built-in tools
  const tools: Record<string, any> = { ...builtinTools };
  
  // 3. Add MCP tools if configured
  if (config?.mcpServers && config.mcpServers.length > 0) {
    console.log(`[Tools] Fetching MCP tools from ${config.mcpServers.length} server(s) for tenant: ${orgId}`);
    
    // Fetch tools from each MCP server
    for (const mcpServer of config.mcpServers) {
      if (!mcpServer.url) {
        console.warn(`[Tools] Skipping MCP server with missing URL for tenant: ${orgId}`);
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
    console.log(`[Tools] No MCP servers configured for tenant: ${orgId}`);
  }
  
  // TODO: Add webhook tools here
  // if (config?.webhookTools) {
  //   const webhookTools = await createWebhookTools(config.webhookTools);
  //   Object.assign(tools, webhookTools);
  // }
  
  const totalToolCount = Object.keys(tools).length;
  console.log(`[Tools] Total tools available for ${orgId}: ${totalToolCount}`);
  
  return tools;
}

export type { WebhookToolConfig } from './webhook';
export { createWebhookTool } from './webhook';
export { builtinTools } from './builtin';

