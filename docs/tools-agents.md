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

## Advanced Features

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

### Structured Outputs ✅

Agents can return structured data instead of plain text using Zod schemas. This is useful for data extraction, form filling, and structured responses.

**How it works:**

1. Define a Zod schema in the agent config (`outputSchema` field)
2. The agent returns structured data matching that schema
3. Result is available in `result.finalOutput` as a structured object

**Example: Calendar Event Extractor**

```typescript
import { z } from 'zod';

// Define the output schema
const CalendarEventSchema = z.object({
  events: z.array(
    z.object({
      name: z.string().describe('Event name or title'),
      date: z.string().describe('Event date in ISO format'),
      time: z.string().nullable().optional().describe('Event time if specified'),
      participants: z.array(z.string()).describe('List of participants or attendees'),
      location: z.string().nullable().optional().describe('Event location if specified'),
    })
  ),
});

// Configure agent in worker/src/tenants/config.ts
const agentConfig = {
  agentId: 'calendar-extractor',
  orgId: 'platform',
  name: 'Calendar Event Extractor',
  systemPrompt: 'Extract calendar events from the supplied text.',
  model: 'gpt-4.1-mini',
  outputSchema: CalendarEventSchema, // Add the schema here
};
```

**Agent creation with structured output:**

```typescript
import { Agent } from '@openai/agents';

const agent = new Agent({
  name: 'Calendar Extractor',
  instructions: 'Extract calendar events from the supplied text.',
  outputType: CalendarEventSchema, // Pass the Zod schema
});

const result = await run(agent, 'Meeting with Bob tomorrow at 2pm');
// result.finalOutput will be: { events: [{ name: "Meeting with Bob", date: "...", ... }] }
```

**Try it out:**

```bash
# Send a message to the calendar-extractor agent
curl -X POST http://localhost:8787/api/chats?agent=calendar-extractor \
  -H "Content-Type: application/json" \
  -d '{"message": "Team standup Monday 9am with Alice and Bob. Client demo Tuesday 3pm in Building A."}'
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
    },
    {
      "name": "Client demo",
      "date": "2024-12-31",
      "time": "3:00 PM",
      "participants": [],
      "location": "Building A"
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

**UX Benefits:**
- No raw JSON visible to users during streaming (shows "Thinking..." instead)
- Clean display of just the answer, with optional technical details
- Plain text responses still stream naturally word-by-word

**Response field convention:**

```typescript
interface StructuredResponse {
  response: string;       // Main text to display to user
  suggestions?: string[]; // Optional: Quick-reply buttons shown below message
  [key: string]: any;     // Any other fields (logged but not displayed)
}
```

**Example with suggestions:**

If the agent returns:
```json
{
  "response": "I can help you with scheduling. What would you like to do?",
  "suggestions": [
    "Schedule a meeting",
    "View my calendar",
    "Cancel an appointment"
  ]
}
```

The user sees:
- **Text:** "I can help you with scheduling. What would you like to do?"
- **Buttons below:** Three clickable suggestion buttons (only on the latest message)
- **Clicking a button:** Sends that text as the user's next message
- **After new message:** Old suggestions disappear (only latest message shows suggestions)

**Benefits:**
- Quick-reply buttons for common follow-ups
- Guided conversation flows
- Better mobile UX (less typing required)

**Try it out:**

The `support-bot` agent is configured to always include suggestions:

```bash
# Chat with the support bot
curl -X POST http://localhost:8787/api/chats?agent=support-bot \
  -H "Content-Type: application/json" \
  -d '{"message": "I need help"}'
```

Response will include clickable suggestions like:
- "Check my order status"
- "Track a shipment"
- "Contact support"
- "View return policy"

**Widget implementation:**
- Parser: `widget/src/lib/structured-output.ts`
- Message component: `widget/src/components/Message.tsx` (renders suggestion buttons)
- Chat flow: `widget/src/components/Chat.tsx` (handles button clicks)
- Tests: `widget/src/lib/structured-output.test.ts` (17 tests ✓)

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

