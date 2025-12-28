# MCP Test Server

A local Model Context Protocol (MCP) server for testing tool integration with the multi-tenant chat assistant.

## Overview

This standalone MCP server implements the JSON-RPC 2.0 protocol and provides test tools that can be used by AI agents. It's built with Hono for lightweight HTTP handling.

## Available Tools

### scottPhysicsFacts

Returns Scott's curated list of the top 10 most interesting physics facts.

**Parameters:**
- `format` (optional): Output format
  - `"full"` (default): Returns complete JSON with rank, fact, and category
  - `"summary"`: Returns simple numbered list

**Example response (full format):**
```json
[
  {
    "rank": 1,
    "fact": "Quantum Entanglement: Einstein called it 'spooky action at a distance.'...",
    "category": "Quantum Mechanics"
  },
  ...
]
```

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

The server will start on `http://localhost:3030`

## Endpoints

### POST /

Main MCP endpoint for JSON-RPC 2.0 requests.

**List available tools:**
```bash
curl -X POST http://localhost:3030 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

**Call a tool:**
```bash
curl -X POST http://localhost:3030 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "scottPhysicsFacts",
      "arguments": {
        "format": "summary"
      }
    }
  }'
```

### GET /

Returns server information and available tools.

### GET /health

Health check endpoint.

## Integration with Chat Assistant

To connect this MCP server to your chat assistant:

1. Start the MCP server:
   ```bash
   cd mcp
   npm run dev
   ```

2. Configure an agent to use it in `worker/src/tenants/config.ts`:
   ```typescript
   {
     agentId: 'test-agent',
     orgId: 'test-org',
     name: 'Test Agent',
     mcpServers: [
       {
         url: 'http://localhost:3030',
         transport: 'http'
       }
     ]
   }
   ```

3. Start the worker and test with the agent

## Protocol

This server implements the [Model Context Protocol](https://github.com/modelcontextprotocol/specification) using JSON-RPC 2.0.

**Supported methods:**
- `tools/list` - List available tools
- `tools/call` - Execute a tool

## Development

- **Port**: 3030 (configurable in `src/index.ts`)
- **Framework**: Hono
- **Runtime**: Node.js with tsx for TypeScript execution
- **Hot reload**: Enabled with `npm run dev`

## Adding New Tools

1. Add tool definition to `TOOLS` array:
```typescript
{
  name: 'myNewTool',
  description: 'What the tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Parameter description' }
    }
  }
}
```

2. Handle the tool in `tools/call` method:
```typescript
if (name === 'myNewTool') {
  const result = // ... your tool logic
  return c.json({
    jsonrpc: '2.0',
    id,
    result: { result, isError: false }
  });
}
```

## License

Same as parent project

