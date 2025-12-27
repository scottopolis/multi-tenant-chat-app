import { createMCPClient } from '@ai-sdk/mcp';

/**
 * MCP Client for connecting to Model Context Protocol servers
 * 
 * This module provides a wrapper around @ai-sdk/mcp to connect to external
 * MCP servers and fetch their tools. Tools are automatically converted to
 * AI SDK format and can be used directly with streamText().
 * 
 * Supports:
 * - HTTP transport (recommended for production)
 * - SSE transport (alternative HTTP-based transport)
 * - Authentication via custom headers
 * 
 * @see https://github.com/modelcontextprotocol/specification
 */

export interface MCPClientConfig {
  /** MCP server URL */
  serverUrl: string;
  /** Optional authentication header (e.g., "Bearer token") */
  authHeader?: string;
  /** Transport type (http or sse) - defaults to http */
  transport?: 'http' | 'sse';
}

/**
 * Create an MCP client and connect to the server
 * 
 * @param config - MCP server configuration
 * @returns MCP client instance
 * 
 * @example
 * const client = await createTenantMCPClient({
 *   serverUrl: 'https://mcp.example.com/api',
 *   authHeader: 'Bearer secret-token',
 *   transport: 'http',
 * });
 */
export async function createTenantMCPClient(config: MCPClientConfig) {
  const { serverUrl, authHeader, transport = 'http' } = config;

  // Prepare headers
  const headers: Record<string, string> = {};
  if (authHeader) {
    headers.Authorization = authHeader;
  }

  // Create MCP client with appropriate transport
  const mcpClient = await createMCPClient({
    transport: {
      type: transport,
      url: serverUrl,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    },
  });

  return mcpClient;
}

/**
 * Get tools from an MCP server
 * 
 * This function connects to an MCP server, fetches its tools, and returns
 * them in AI SDK format. The tools are ready to use with streamText().
 * 
 * If the connection fails, logs an error and returns an empty object,
 * allowing the agent to continue with other available tools.
 * 
 * @param config - MCP server configuration
 * @returns Record of tools in AI SDK format
 * 
 * @example
 * const tools = await getMCPTools({
 *   serverUrl: 'https://mcp.example.com/api',
 *   authHeader: 'Bearer secret-token',
 * });
 * 
 * // Use with streamText
 * streamText({
 *   model: openrouter.chat('gpt-4'),
 *   messages,
 *   tools, // MCP tools + any other tools
 * });
 */
export async function getMCPTools(
  config: MCPClientConfig
): Promise<Record<string, any>> {
  try {
    console.log(`[MCP] Connecting to server: ${config.serverUrl}`);
    const client = await createTenantMCPClient(config);

    // Get tools from the MCP client
    // The AI SDK MCP package automatically converts MCP tools to AI SDK format
    const tools = await client.tools();
    
    const toolNames = Object.keys(tools);
    console.log(`[MCP] Connected successfully. Tools available: ${toolNames.join(', ')}`);

    // Note: We don't close the client here because we need it during execution
    // The caller is responsible for cleanup if needed
    return tools;
  } catch (error) {
    console.error('[MCP] Failed to connect to MCP server:', error);
    console.error('[MCP] Server URL:', config.serverUrl);
    
    // Return empty tools - agent can continue with other available tools
    return {};
  }
}

/**
 * Close an MCP client connection
 * 
 * Call this when done to clean up resources. In Cloudflare Workers,
 * connections are typically per-request, so this should be called
 * after the agent completes its work.
 * 
 * @param client - MCP client instance to close
 * 
 * @example
 * const client = await createTenantMCPClient(config);
 * try {
 *   // Use the client...
 * } finally {
 *   await closeMCPClient(client);
 * }
 */
export async function closeMCPClient(
  client: Awaited<ReturnType<typeof createMCPClient>>
) {
  try {
    await client.close();
    console.log('[MCP] Client closed successfully');
  } catch (error) {
    console.error('[MCP] Error closing MCP client:', error);
  }
}

