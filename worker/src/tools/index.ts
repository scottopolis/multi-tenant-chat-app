import { builtinTools } from './builtin';

/**
 * Tool registry
 * 
 * TODO: Org-specific tool configuration
 * - Fetch enabled built-in tools from org settings
 * - Fetch webhook tool definitions from org config
 * - Merge and return combined tools
 * - Cache tool configurations per org
 */

/**
 * Get all available tools for an organization
 * 
 * For now, returns all built-in tools. In production, this would:
 * 1. Fetch org-specific settings to see which built-in tools are enabled
 * 2. Fetch custom webhook tool definitions for the org
 * 3. Combine and return the merged tool set
 */
export function getTools(orgId: string) {
  // TODO: Fetch org-specific tool configuration
  // const orgConfig = await fetchOrgConfig(orgId);
  // const enabledBuiltinTools = filterEnabledTools(builtinTools, orgConfig.enabledTools);
  // const webhookTools = await fetchWebhookTools(orgId);
  // return { ...enabledBuiltinTools, ...webhookTools };
  
  return builtinTools;
}

export type { WebhookToolConfig } from './webhook';
export { createWebhookTool } from './webhook';
export { builtinTools } from './builtin';

