import { builtinTools } from './builtin';
import { getMCPTools } from '../mcp';
import { getTenantConfig } from '../tenants/config';

/**
 * Tool registry
 * 
 * ✅ MCP Server Integration - Implemented
 * - Connects to tenant's MCP server if configured
 * - Fetches tools from MCP server
 * - Merges with built-in tools
 * 
 * TODO: Future enhancements
 * - Fetch enabled built-in tools from org settings (selective tool enabling)
 * - Fetch webhook tool definitions from org config
 * - Cache tool configurations per org (with TTL)
 * - Support multiple MCP servers per tenant
 */

/**
 * Get all available tools for an organization
 * 
 * Combines:
 * 1. Built-in tools (currentTime, calculator, etc.)
 * 2. MCP server tools (if tenant has MCP server configured)
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
  if (config?.mcpServer?.url) {
    console.log(`[Tools] Fetching MCP tools for tenant: ${orgId}`);
    const mcpTools = await getMCPTools({
      serverUrl: config.mcpServer.url,
      authHeader: config.mcpServer.authHeader,
      transport: config.mcpServer.transport || 'http',
    });
    
    // Merge MCP tools (MCP tools can override built-in tools if same name)
    Object.assign(tools, mcpTools);
    
    const mcpToolCount = Object.keys(mcpTools).length;
    console.log(`[Tools] Added ${mcpToolCount} MCP tools`);
  } else {
    console.log(`[Tools] No MCP server configured for tenant: ${orgId}`);
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

