# Tools & Agents

This guide explains how the agent system works and how to add custom tools.

## Agent Overview

The agent is powered by **TanStack AI** (`@tanstack/ai`) with **OpenRouter** for provider-agnostic model access, providing:
- **Multiple model providers**: Claude, GPT, Gemini, Llama via OpenRouter
- **Native tool/function calling** with automatic execution
- **Built-in agent loop strategies** (`maxIterations`, `untilFinishReason`)
- **Type-safe tools** with Zod schemas and full TypeScript inference
- **MCP (Model Context Protocol)** integration via HTTP

## Available Models

The system supports models from multiple providers via OpenRouter:

**OpenAI:**
- `openai/gpt-4.1-mini` - Default model, fast and cost-effective
- `openai/gpt-4.1` - More capable GPT model

**Anthropic:**
- `anthropic/claude-sonnet-4` - Excellent reasoning and coding

**Google:**
- `google/gemini-2.0-flash` - Fast and affordable

**Meta:**
- `meta-llama/llama-4-scout` - Open-source Llama model

**Note:** Model availability depends on your OpenRouter account. See [OpenRouter Models](https://openrouter.ai/models) for the full list.

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

**Implementation (TanStack format):**
```typescript
import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';

export const currentTimeDef = toolDefinition({
  name: 'currentTime',
  description: 'Get the current date and time',
  inputSchema: z.object({
    timezone: z.string().optional().describe('Optional timezone'),
  }),
  outputSchema: z.object({
    timestamp: z.string(),
    formatted: z.string(),
    timezone: z.string(),
  }),
});

export const currentTimeTool = currentTimeDef.server(async (input) => {
  const now = new Date();
  const timeString = input.timezone 
    ? now.toLocaleString('en-US', { timeZone: input.timezone })
    : now.toISOString();
  
  return {
    timestamp: now.toISOString(),
    formatted: timeString,
    timezone: input.timezone || 'UTC',
  };
});
```

### Calculator Tool

Performs basic arithmetic operations.

**Usage:**
```typescript
// User: "What's 127 * 43?"
// Agent: *calls calculator tool with operation="multiply", a=127, b=43*
```

## Adding Built-in Tools

To add a new built-in tool:

1. **Create the tool definition in `worker/src/tools/`:**

```typescript
import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';

// Define the tool schema
export const webSearchDef = toolDefinition({
  name: 'webSearch',
  description: 'Search the web for information',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    numResults: z.number().optional().default(5).describe('Number of results'),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      title: z.string(),
      url: z.string(),
      snippet: z.string(),
    })),
  }),
});

// Implement the server-side handler
export const webSearchTool = webSearchDef.server(async (input) => {
  // Implement web search using Brave API, Serper, etc.
  const results = await searchWeb(input.query, input.numResults);
  return { results };
});
```

2. **Add it to `getAiTools()` in `worker/src/tools/index.ts`:**

```typescript
export async function getAiTools(agentId: string, env?: AgentConfigEnv, options?: GetToolsOptions) {
  const config = await getAgentConfig(agentId, env);
  const tools = [];
  
  // Add built-in tools
  tools.push(webSearchTool);
  
  // Add knowledge base tool if configured
  if (config?.agentConvexId && options?.convexUrl) {
    tools.push(createKnowledgeBaseSearchToolTanStack(options.convexUrl, agentId));
  }
  
  return tools;
}
```

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
const agentConfig = await getAgentConfig(agentId);

// The TanStack runner uses these settings
const options = {
  messages: tanstackMessages,
  apiKey: OPENROUTER_API_KEY,
  agentId,
  model: agentConfig.model || 'openai/gpt-4.1-mini',
  systemPrompt: agentConfig.systemPrompt,
  env,
};
```

## Tool Use Flow

1. User sends a message
2. Agent analyzes if it needs to use tools
3. If yes, agent calls the appropriate tool(s)
4. Tool executes and returns results
5. Agent incorporates tool results into response
6. Steps 2-5 repeat up to `maxIterations` times (default: 8)
7. Agent sends final response to user

## Best Practices

1. **Tool Descriptions**: Be clear and specific about what each tool does
2. **Parameter Schemas**: Use detailed descriptions in Zod schemas
3. **Error Handling**: Tools should handle errors gracefully
4. **Performance**: Keep tool execution fast (<2 seconds ideally)
5. **Security**: Validate all inputs and sanitize outputs

## Advanced Features

### Agent Loop Strategies

TanStack AI provides built-in strategies for controlling the agent loop:

```typescript
import { chat, maxIterations, untilFinishReason } from '@tanstack/ai';

// Run up to 8 iterations
const result = await chat({
  adapter,
  messages,
  tools,
  agentLoopStrategy: maxIterations(8),
});

// Or run until a specific finish reason
const result = await chat({
  adapter,
  messages,
  tools,
  agentLoopStrategy: untilFinishReason('stop'),
});
```

### Structured Outputs ✅

Agents can return structured data instead of plain text using Zod schemas. This is useful for data extraction, form filling, and structured responses.

**Example: Calendar Event Extractor**

```typescript
import { z } from 'zod';

// Define the output schema
const CalendarEventSchema = z.object({
  events: z.array(
    z.object({
      name: z.string().describe('Event name or title'),
      date: z.string().describe('Event date in ISO format'),
      time: z.string().optional().describe('Event time if specified'),
      participants: z.array(z.string()).describe('List of participants'),
      location: z.string().optional().describe('Event location if specified'),
    })
  ),
});
```

**Response will be structured JSON:**

```json
{
  "events": [
    {
      "name": "Team standup",
      "date": "2024-12-30",
      "time": "9:00 AM",
      "participants": ["Alice", "Bob"],
      "location": null
    }
  ]
}
```

**Use cases:**
- Data extraction from unstructured text
- Form filling from natural language input
- Parsing emails for action items
- Converting documents to structured formats
- Creating database entries from conversations

### Client-Side Handling

The widget automatically detects and parses structured JSON responses:

**How it works:**
1. First chunk is checked - if it starts with `{` or `[`, it's detected as structured
2. **Structured responses:** Buffered entirely (no partial JSON shown), then parsed after completion
3. **Plain text responses:** Streamed normally, showing text as it arrives
4. If JSON has a `response` field, only that field is displayed
5. Other fields (like `reasoning`) are shown in a collapsible "Show details" section

**Response field convention:**

```typescript
interface StructuredResponse {
  response: string;       // Main text to display to user
  suggestions?: string[]; // Optional: Quick-reply buttons shown below message
  [key: string]: any;     // Any other fields (logged but not displayed)
}
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

- **Langfuse Integration**: Track tool usage and costs
- **Tool Authorization**: Per-user or per-org tool access control
- **Tool Composition**: Allow tools to call other tools
- **Human-in-the-Loop**: Approval workflows for sensitive tools
