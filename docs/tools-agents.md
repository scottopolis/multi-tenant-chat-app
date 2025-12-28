# Tools & Agents

This guide explains how the agent system works and how to add custom tools.

## Agent Overview

The agent is powered by the **OpenAI Agents SDK** (`@openai/agents`), providing advanced capabilities including:
- **Conversation continuity** using `previousResponseId` pattern
- **Native tool/function calling** with automatic execution
- **Agent handoffs** for multi-agent orchestration (prepared)
- **Structured outputs** with response format schemas (prepared)
- **MCP (Model Context Protocol)** integration via HTTP

## Available Models

The system supports OpenAI models via the Agents SDK:

**Fast & Affordable (Default):**
- `gpt-4.1-mini` - Default model, fast and cost-effective
- `gpt-4o-mini` - Alternative fast model

**Balanced:**
- `gpt-4.1` - More capable GPT model
- `gpt-4o` - Balanced performance and cost

**Most Capable:**
- `o1` - Advanced reasoning model
- `o1-mini` - Faster reasoning model
- `o3-mini` - Latest reasoning model

**Note:** After migrating from OpenRouter to OpenAI Agents SDK, only OpenAI models are supported. This trade-off enables advanced features like agent handoffs and structured outputs.

## Built-in Tools

### Current Time Tool

Returns the current date and time.

**Usage:**
```typescript
import { currentTime } from './tools/builtin';

// The agent can call this automatically
// User: "What time is it?"
// Agent: *calls currentTime tool*
```

**Implementation:**
```typescript
import { tool } from '@openai/agents';
import { z } from 'zod';

export const currentTime = tool({
  name: 'currentTime', // Required in Agents SDK
  description: 'Get the current date and time',
  parameters: z.object({
    timezone: z.string().nullable().optional(), // Optional params must be nullable
  }),
  execute: async ({ timezone }) => {
    const now = new Date();
    const timeString = timezone 
      ? now.toLocaleString('en-US', { timeZone: timezone })
      : now.toISOString();
    
    return {
      timestamp: now.toISOString(),
      formatted: timeString,
      timezone: timezone || 'UTC',
    };
  },
});
```

**Important:** In the OpenAI Agents SDK, optional parameters must use `.nullable().optional()` chaining.

### Calculator Tool

Performs basic arithmetic operations.

**Usage:**
```typescript
// User: "What's 127 * 43?"
// Agent: *calls calculator tool with operation="multiply", a=127, b=43*
```

## Adding Built-in Tools

To add a new built-in tool:

1. **Create the tool in `worker/src/tools/builtin.ts`:**

```typescript
import { tool } from '@openai/agents';
import { z } from 'zod';

export const webSearch = tool({
  name: 'webSearch', // Required: tool name
  description: 'Search the web for information',
  parameters: z.object({
    query: z.string().describe('The search query'),
    numResults: z.number().nullable().optional().describe('Number of results (default 5)'),
  }),
  execute: async ({ query, numResults = 5 }) => {
    // Implement web search using Brave API, Serper, etc.
    const results = await searchWeb(query, numResults);
    return results;
  },
});
```

2. **Add it to the array export:**

```typescript
import { tool } from '@openai/agents';

export const builtinTools = [
  currentTime,
  calculator,
  webSearch, // Add your new tool
];
```

**Note:** Tools are now exported as an array, not an object, per the Agents SDK format.

3. **The agent will automatically have access to it!**

## Webhook Tools

Webhook tools allow organizations to define custom functionality by providing a webhook endpoint.

### Creating a Webhook Tool

```typescript
import { createWebhookTool } from './tools/webhook';
import { z } from 'zod';

const customTool = createWebhookTool({
  name: 'getUserData',
  description: 'Fetch user data from CRM',
  parameters: z.object({
    userId: z.string().describe('The user ID to look up'),
  }),
  webhookUrl: 'https://your-app.com/webhooks/get-user',
  headers: {
    'X-API-Key': 'your-api-key',
  },
});
```

### Webhook Request Format

When the agent calls a webhook tool, it sends a POST request:

```http
POST https://your-app.com/webhooks/get-user
Content-Type: application/json
X-API-Key: your-api-key

{
  "userId": "user-123"
}
```

### Webhook Response Format

Your webhook should return JSON:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "status": "active"
}
```

The agent will receive this data and use it to formulate its response.

## Customizing the Agent

### Changing the System Prompt

Edit `worker/src/agents/prompts.ts`:

```typescript
export const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant specialized in customer support.

Your role is to:
- Answer questions about our products
- Help troubleshoot issues
- Escalate to human support when needed

Be friendly, professional, and concise.`;
```

### Per-Agent Configuration

Agents can be configured per organization in `worker/src/tenants/config.ts`:

```typescript
import { Agent, run } from '@openai/agents';

const agentConfig = await getAgentConfig(agentId);

const agent = new Agent({
  name: agentConfig.name || agentId,
  instructions: agentConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT,
  model: agentConfig.model || 'gpt-4.1-mini',
  tools: await getTools(agentId),
});

const result = await run(agent, lastUserMessage, {
  stream: true,
  previousResponseId: chat.lastResponseId, // Conversation continuity
});
```

### Conversation Continuity

The system uses the `previousResponseId` pattern for maintaining context:

```typescript
// First turn
const result1 = await run(agent, 'What city is the Golden Gate Bridge in?', {
  stream: true,
});
// Save result1.lastResponseId

// Second turn - pass previousResponseId
const result2 = await run(agent, 'What state is it in?', {
  stream: true,
  previousResponseId: result1.lastResponseId, // Context from first turn
});
```

This approach:
- Maintains conversation context across turns
- Avoids sending full message history every time
- More efficient than client-side history management
- Follows OpenAI's recommended pattern

See [OpenAI Agents SDK Streaming Docs](https://openai.github.io/openai-agents-js/guides/streaming/) for more details.

## Tool Use Flow

1. User sends a message
2. Agent analyzes if it needs to use tools
3. If yes, agent calls the appropriate tool(s)
4. Tool executes and returns results
5. Agent incorporates tool results into response
6. Steps 2-5 repeat up to `maxSteps` times
7. Agent sends final response to user

## Best Practices

1. **Tool Descriptions**: Be clear and specific about what each tool does
2. **Parameter Schemas**: Use detailed descriptions in Zod schemas
3. **Error Handling**: Tools should handle errors gracefully
4. **Performance**: Keep tool execution fast (<2 seconds ideally)
5. **Security**: Validate all inputs and sanitize outputs

## Advanced Features (Prepared)

### Agent Handoffs

The OpenAI Agents SDK supports native handoffs between agents:

```typescript
import { Handoff } from '@openai/agents';

const refundHandoff = new Handoff({
  name: 'transfer_to_refund_agent',
  description: 'Transfer to refund specialist',
  agent: refundAgent,
});

const supportAgent = new Agent({
  name: 'Support Agent',
  handoffs: [refundHandoff],
});
```

### Structured Outputs

Configure agents to return structured data:

```typescript
const agent = new Agent({
  name: 'Data Extractor',
  outputType: 'structured',
  responseFormat: {
    type: 'json_schema',
    json_schema: {
      name: 'user_info',
      schema: z.object({
        name: z.string(),
        email: z.string(),
        phone: z.string().nullable().optional(),
      }),
    },
  },
});
```

### MCP (Model Context Protocol) Integration

Connect external MCP servers via HTTP:

```typescript
const agentConfig = {
  agentId: 'support-agent',
  mcpServers: [
    {
      url: 'http://localhost:3001',
      transport: 'http',
    },
  ],
};
```

## Future Enhancements

- **Langfuse Integration**: Track tool usage and costs with experimental_telemetry
- **Server-managed Conversations**: Use OpenAI's Conversations API
- **Tool Authorization**: Per-user or per-org tool access control
- **Tool Composition**: Allow tools to call other tools
- **RAG Tools**: Add vector database search for knowledge retrieval
- **Human-in-the-Loop**: Approval workflows for sensitive tools
- **Voice Agents**: OpenAI Realtime API integration

