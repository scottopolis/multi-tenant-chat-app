# Tools & Agents

This guide explains how the agent system works and how to add custom tools.

## Agent Overview

The agent is powered by the Vercel AI SDK and uses OpenRouter to access various AI models. It can use tools (function calling) to extend its capabilities.

## Available Models

The system supports multiple models via OpenRouter:

**Fast & Affordable:**
- `gpt-4.1-mini` - Default model
- `claude-3.5-haiku` - Fast Claude model

**Balanced:**
- `gpt-4.1` - More capable GPT model
- `claude-3.5-sonnet` - Excellent reasoning

**Most Capable:**
- `gpt-o3` - Latest OpenAI model
- `claude-3.5-opus` - Most capable Claude

**Open Source:**
- `llama-3.3-70b` - Meta's Llama
- `deepseek-v3` - DeepSeek Chat

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
export const currentTime = tool({
  description: 'Get the current date and time',
  parameters: z.object({
    timezone: z.string().optional(),
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
export const webSearch = tool({
  description: 'Search the web for information',
  parameters: z.object({
    query: z.string().describe('The search query'),
    numResults: z.number().optional().describe('Number of results (default 5)'),
  }),
  execute: async ({ query, numResults = 5 }) => {
    // Implement web search using Brave API, Serper, etc.
    const results = await searchWeb(query, numResults);
    return results;
  },
});
```

2. **Add it to the exports:**

```typescript
export const builtinTools = {
  currentTime,
  calculator,
  webSearch, // Add your new tool
};
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

Edit `worker/src/agents/index.ts`:

```typescript
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant specialized in customer support.

Your role is to:
- Answer questions about our products
- Help troubleshoot issues
- Escalate to human support when needed

Be friendly, professional, and concise.`;
```

### Per-Organization Configuration

In the future, you can configure agents per organization:

```typescript
// TODO: Fetch from database
const orgConfig = await getOrgConfig(orgId);

const result = await runAgent({
  messages,
  apiKey,
  orgId,
  model: orgConfig.model || 'gpt-4.1-mini',
  systemPrompt: orgConfig.systemPrompt || DEFAULT_SYSTEM_PROMPT,
});
```

### Adjusting Generation Parameters

Modify the `streamText` call in `worker/src/agents/index.ts`:

```typescript
const result = streamText({
  model: openrouter.chat(modelId),
  messages: messagesWithSystem,
  tools,
  maxSteps: 5, // Max tool use iterations
  temperature: 0.7, // Add temperature control
  maxTokens: 2000, // Add token limit
});
```

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

## Future Enhancements

- **Langfuse Integration**: Track tool usage and costs
- **Tool Authorization**: Per-user or per-org tool access
- **Streaming Tool Results**: Stream long tool outputs
- **Tool Composition**: Allow tools to call other tools
- **RAG Tools**: Add vector database search for knowledge retrieval

