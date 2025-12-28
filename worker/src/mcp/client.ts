import { z } from 'zod';
import { tool } from '@openai/agents';

/**
 * MCP Client for connecting to Model Context Protocol servers
 * 
 * This module makes direct HTTP calls to MCP servers to discover and execute tools.
 * Converts MCP tools to OpenAI Agents SDK tool format.
 * 
 * Approach:
 * 1. Call tools/list to discover available tools
 * 2. Convert JSON schemas to Zod schemas
 * 3. Create AI SDK tools that call tools/call endpoint
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
 * Parse SSE (Server-Sent Events) response format
 * 
 * SSE format looks like:
 * event: message
 * data: {"jsonrpc":"2.0","result":{...}}
 * 
 * Or just:
 * data: {"jsonrpc":"2.0","result":{...}}
 */
function parseSSEResponse(sseText: string): any {
  const lines = sseText.split('\n');
  let jsonData = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data: ')) {
      // Extract JSON from data: line
      jsonData += trimmed.substring(6);
    } else if (trimmed.startsWith('data:')) {
      jsonData += trimmed.substring(5);
    }
  }
  
  if (!jsonData) {
    throw new Error('No data found in SSE response');
  }
  
  return JSON.parse(jsonData);
}

/**
 * Get tools from an MCP server
 * 
 * This function connects to an MCP server, fetches its tools, and returns
 * them in OpenAI Agents SDK format. The tools are ready to use with Agent.
 * 
 * If the connection fails, logs an error and returns an empty array,
 * allowing the agent to continue with other available tools.
 * 
 * @param config - MCP server configuration
 * @returns Array of tools in Agents SDK format
 * 
 * @example
 * const tools = await getMCPTools({
 *   serverUrl: 'https://mcp.example.com/api',
 *   authHeader: 'Bearer secret-token',
 * });
 * 
 * // Use with Agent
 * const agent = new Agent({
 *   name: 'Assistant',
 *   instructions: 'You are helpful',
 *   tools: [...builtinTools, ...tools], // MCP tools + any other tools
 * });
 */
export async function getMCPTools(
  config: MCPClientConfig
): Promise<any[]> {
  try {
    console.log(`[MCP] Connecting to server: ${config.serverUrl} (transport: ${config.transport || 'http'})`);
    
    // Use SSE transport - try GET with message in URL or body
    if (config.transport === 'sse') {
      console.log('[MCP] Using SSE transport - trying direct message endpoint');
      
      // For SSE, we might need to connect to the SSE stream directly
      // Try GET with message parameter
      const sseUrl = new URL(config.serverUrl);
      const message = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {},
      };
      sseUrl.searchParams.set('message', JSON.stringify(message));
      
      console.log('[MCP] SSE URL:', sseUrl.toString());
      
      const response = await fetch(sseUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'User-Agent': 'Mozilla/5.0 (compatible; MCPClient/1.0)',
          ...(config.authHeader ? { 'Authorization': config.authHeader } : {}),
        },
      });
      
      console.log(`[MCP] SSE Response status: ${response.status}`);
      const text = await response.text();
      console.log('[MCP] SSE Response:', text.substring(0, 500));
      
      throw new Error('SSE transport not yet fully implemented - use http transport');
    }
    
    // Make a simple HTTP POST to call MCP tools directly
    // Bypass the @ai-sdk/mcp wrapper to avoid dynamic tool issues
    const callMCPTool = async (toolName: string, args: any) => {
      const response = await fetch(config.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'User-Agent': 'Mozilla/5.0 (compatible; MCPClient/1.0)',
          ...(config.authHeader ? { 'Authorization': config.authHeader } : {}),
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`MCP call failed: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      
      // Parse SSE or JSON response
      let result: any;
      if (responseText.startsWith('event:') || responseText.startsWith('data:')) {
        result = parseSSEResponse(responseText);
      } else {
        result = JSON.parse(responseText);
      }
      
      if (result.error) {
        throw new Error(`MCP error: ${result.error.message || JSON.stringify(result.error)}`);
      }

      return result.result?.result || JSON.stringify(result.result || result);
    };

    // First, list available tools from the server
    const requestHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'User-Agent': 'Mozilla/5.0 (compatible; MCPClient/1.0)',
      ...(config.authHeader ? { 'Authorization': config.authHeader } : {}),
    };
    
    const requestBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {},
    };
    
    console.log('[MCP] Sending HTTP POST request');
    
    const listResponse = await fetch(config.serverUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    });

    console.log(`[MCP] Response status: ${listResponse.status} ${listResponse.statusText}`);

    if (!listResponse.ok) {
      const text = await listResponse.text();
      console.error(`[MCP] Error response body: ${text.substring(0, 300)}`);
      throw new Error(`MCP server error: ${listResponse.status} ${listResponse.statusText}`);
    }

    const responseText = await listResponse.text();
    console.log('[MCP] Success response:', responseText.substring(0, 300));
    
    // Check if response is SSE format or plain JSON
    let listResult;
    if (responseText.startsWith('event:') || responseText.startsWith('data:')) {
      // Parse SSE format
      console.log('[MCP] Response is in SSE format, parsing...');
      listResult = parseSSEResponse(responseText);
    } else {
      // Plain JSON
      listResult = JSON.parse(responseText);
    }
    
    const availableTools = listResult.result?.tools || [];
    
    console.log(`[MCP] Server offers ${availableTools.length} tools: ${availableTools.map((t: any) => t.name).join(', ')}`);

    // Create Agents SDK tools for each MCP tool
    const tools: any[] = [];
    
    for (const mcpTool of availableTools) {
      const { name, description, inputSchema } = mcpTool;
      
      // Convert JSON Schema to simple Zod schema
      const zodSchema = buildZodFromJsonSchema(inputSchema);
      
      // Create tool using Agents SDK tool() function
      const agentTool = tool({
        name: name,
        description: description || `MCP tool: ${name}`,
        parameters: zodSchema,
        execute: async (args: any) => {
          console.log(`[MCP] Calling tool: ${name} with args:`, args);
          const result = await callMCPTool(name, args);
          console.log(`[MCP] Tool ${name} returned:`, typeof result === 'string' ? result.substring(0, 200) : JSON.stringify(result).substring(0, 200));
          return result;
        },
      });
      
      tools.push(agentTool);
      console.log(`[MCP] ✓ Registered tool: ${name}`);
    }

    console.log(`[MCP] Successfully loaded ${tools.length} tools`);
    return tools;
  } catch (error) {
    console.error('[MCP] Failed to connect to MCP server:', error);
    console.error('[MCP] Server URL:', config.serverUrl);
    console.error('[MCP] Error details:', error instanceof Error ? error.stack : String(error));
    
    // Return empty array - agent can continue with other available tools
    return [];
  }
}

/**
 * Build a simple Zod schema from JSON Schema
 * Simplified version - just handles basic object properties
 */
function buildZodFromJsonSchema(jsonSchema: any): z.ZodObject<any> {
  if (!jsonSchema?.properties) {
    // No properties defined - return empty object schema
    return z.object({});
  }

  const { properties, required = [] } = jsonSchema;
  const shape: Record<string, z.ZodType<any>> = {};
  
  for (const [key, prop] of Object.entries(properties as Record<string, any>)) {
    let schema: z.ZodType<any>;
    
    // Build basic schema based on type
    if (prop.type === 'string') {
      schema = z.string();
      if (prop.description) schema = schema.describe(prop.description);
    } else if (prop.type === 'integer') {
      schema = z.number().int();
      if (prop.description) schema = schema.describe(prop.description);
    } else if (prop.type === 'number') {
      schema = z.number();
      if (prop.description) schema = schema.describe(prop.description);
    } else if (prop.type === 'boolean') {
      schema = z.boolean();
      if (prop.description) schema = schema.describe(prop.description);
    } else {
      schema = z.any();
    }
    
    // Make optional if not in required array
    // OpenAI API requires optional fields to be nullable as well
    if (!required.includes(key)) {
      if (prop.default !== undefined) {
        schema = schema.default(prop.default);
      } else {
        schema = schema.nullable().optional();
      }
    }
    
    shape[key] = schema;
  }
  
  return z.object(shape);
}


