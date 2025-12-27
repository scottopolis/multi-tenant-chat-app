# MCP (Model Context Protocol) Integration

This module provides integration with MCP servers to expose external tools to the AI agent.

## Overview

Model Context Protocol (MCP) is Anthropic's open standard for connecting AI assistants to external tools, data sources, and services. This integration allows tenants to connect their own MCP servers and expose custom tools to their AI agents.

## Architecture

```
┌─────────────────┐
│  Tenant Config  │ → Contains MCP server URL, auth, transport
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  getMCPTools()  │ → Connects to MCP server, fetches tools
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   getTools()    │ → Merges MCP tools with built-in tools
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   runAgent()    │ → Uses tools in streamText
└─────────────────┘
```

## Configuration

Add MCP server configuration to your tenant config:

```typescript
// worker/src/tenants/config.ts

{
  tenantId: 'tenant-1',
  name: 'Acme Corp',
  mcpServer: {
    url: 'http://localhost:3001/mcp',
    authHeader: 'Bearer your-secret-token',
    transport: 'http', // or 'sse'
  },
}
```

## Transport Types

### HTTP (Recommended)
Standard HTTP transport for production use.

```typescript
mcpServer: {
  url: 'https://mcp.example.com/api',
  transport: 'http',
}
```

### SSE (Alternative)
Server-Sent Events transport.

```typescript
mcpServer: {
  url: 'https://mcp.example.com/sse',
  transport: 'sse',
}
```

## Authentication

Add authentication via the `authHeader` field:

```typescript
mcpServer: {
  url: 'https://mcp.example.com/api',
  authHeader: 'Bearer your-secret-token',
  // or
  authHeader: 'X-API-Key: your-api-key',
}
```

## Usage

### Automatic Integration

MCP tools are automatically loaded when a tenant has an MCP server configured:

```typescript
// In runAgent()
const tools = await getTools(orgId);
// tools now includes: built-in tools + MCP tools

const result = streamText({
  model,
  messages,
  tools, // All tools available to the agent
});
```

### Manual Usage

You can also use the MCP client directly:

```typescript
import { getMCPTools } from '../mcp';

const mcpTools = await getMCPTools({
  serverUrl: 'http://localhost:3001/mcp',
  authHeader: 'Bearer token',
});

console.log('Available tools:', Object.keys(mcpTools));
```

## Error Handling

If the MCP server connection fails, the error is logged and an empty object is returned. This allows the agent to continue with other available tools:

```typescript
// If MCP server is down:
// [MCP] Failed to connect to MCP server: ...
// [MCP] Server URL: http://localhost:3001/mcp
// Agent continues with built-in tools only
```

## Cloudflare Workers Considerations

Cloudflare Workers are stateless and have no persistent connections. The MCP integration:

1. **Connects per request** - New MCP connection for each agent execution
2. **No connection pooling** - Each request creates and closes its connection
3. **Timeout-aware** - Consider setting timeouts on MCP server calls

For production scale with persistent connections, consider using Durable Objects.

## Testing

### Test with a Local MCP Server

1. Run an MCP server locally (e.g., on port 3001)
2. Configure a tenant to use it:

```typescript
'test-tenant': {
  tenantId: 'test-tenant',
  mcpServer: {
    url: 'http://localhost:3001/mcp',
  },
}
```

3. Send a message to the agent:

```bash
curl -X POST "http://localhost:8787/api/chats/{chatId}/messages?agent=test-tenant" \
  -H "Content-Type: application/json" \
  -d '{"content": "Use the custom tool"}'
```

### Example MCP Servers

Check out official MCP examples:
- [MCP Servers Repository](https://github.com/modelcontextprotocol/servers)
- Filesystem server
- Git server
- Database server

## Tool Naming

- MCP tools use their names from the MCP server
- If an MCP tool has the same name as a built-in tool, the MCP tool overrides it
- Built-in tools: `currentTime`, `calculator`
- MCP tools: depends on your server (e.g., `lookupOrder`, `searchKB`)

## Debugging

Enable detailed logging:

```typescript
// Look for these log messages:
[Tools] Fetching MCP tools for tenant: tenant-1
[MCP] Connecting to server: http://localhost:3001/mcp
[MCP] Connected successfully. Tools available: tool1, tool2
[Tools] Added 2 MCP tools
[Tools] Total tools available for tenant-1: 4
```

## Future Enhancements

- [ ] Connection pooling with Durable Objects
- [ ] Tool definition caching (with TTL)
- [ ] Support for multiple MCP servers per tenant
- [ ] MCP resources (not just tools)
- [ ] Health checks and reconnection logic
- [ ] OAuth-based authentication

## References

- [Model Context Protocol Specification](https://github.com/modelcontextprotocol/specification)
- [AI SDK MCP Package](https://www.npmjs.com/package/@ai-sdk/mcp)
- [Official MCP Servers](https://github.com/modelcontextprotocol/servers)

