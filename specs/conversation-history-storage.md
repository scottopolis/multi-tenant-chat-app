# Conversation History Storage Spec

Store conversation history in Convex for the multi-tenant chat assistant.

## Overview

- **Source of truth**: Convex database
- **Single table design**: `conversations` table stores both conversation metadata AND events
- **Event types**: messages, tool calls, tool results, system events, errors
- **Conversation continuity**: OpenAI Agents SDK `previousResponseId` stored per conversation
- **Multi-tenant isolation**: All queries filtered by `tenantId` + `agentId`
- **Ownership**: Conversations owned by `userId` (authenticated) or `sessionId` (anonymous)
- **Streaming**: Server persists final content only; widget handles streaming UX

## Security Principles

### Client vs Server Responsibilities

| Source | Fields | Purpose |
|--------|--------|---------|
| **Client sends** | `sessionId`, `userId?`, `pageUrl`, `referrer`, `userAgent`, `locale`, `timezone`, `customMetadata` | User context for analytics & optional prompt injection |
| **Server owns** (from Convex) | `systemPrompt`, `model`, `tools`, `temperature`, `outputSchema` | Agent behavior - never from client |

### Access Control

- Every conversation has `tenantId` and `agentId`
- Convex functions derive `tenantId` from the agent (never trust caller)
- Validate `conversation.tenantId === agent.tenantId` before any read/write
- Worker uses shared secret to authenticate with Convex HTTP actions

### Ownership Rules

- **Anonymous users**: `sessionId` stored in localStorage, conversation has `userId: null`
- **Authenticated users**: `userId` from Clerk, can access chats across devices
- **Query logic**: 
  - Authenticated: `WHERE userId = :userId`
  - Anonymous: `WHERE sessionId = :sessionId AND userId IS NULL`
- **Optional**: Merge anonymous chats to user account on login

## Schema Design

### Single Table: `conversations`

Events are stored as a JSON array within each conversation document. This simplifies queries and keeps related data together.

```ts
conversations: defineTable({
  // Multi-tenant isolation
  tenantId: v.id("tenants"),
  agentId: v.id("agents"),
  orgId: v.optional(v.string()),  // Denormalized for convenience

  // Ownership
  userId: v.optional(v.string()),  // Clerk user ID (null for anonymous)
  sessionId: v.string(),           // Always present, from localStorage

  // Display / UX
  title: v.optional(v.string()),
  status: v.optional(v.union(
    v.literal("active"),
    v.literal("archived")
  )),

  // Provider-level conversation tracking
  providerConversationId: v.optional(v.string()),  // e.g. OpenAI conversationId
  lastResponseId: v.optional(v.string()),          // Last provider response ID

  // Client context (captured at creation, for analytics & prompt injection)
  context: v.optional(v.object({
    pageUrl: v.optional(v.string()),
    referrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    locale: v.optional(v.string()),
    timezone: v.optional(v.string()),
    customMetadata: v.optional(v.any()),
  })),

  // Events array - all conversation events stored here
  events: v.array(v.object({
    seq: v.number(),  // Monotonic sequence for ordering
    eventType: v.union(
      v.literal("message"),
      v.literal("tool_call"),
      v.literal("tool_result"),
      v.literal("system"),
      v.literal("error")
    ),

    // Message fields
    role: v.optional(v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool")
    )),
    content: v.optional(v.string()),

    // Provider info
    model: v.optional(v.string()),
    providerResponseId: v.optional(v.string()),

    // Tool fields
    toolName: v.optional(v.string()),
    toolCallId: v.optional(v.string()),
    toolInput: v.optional(v.any()),
    toolResult: v.optional(v.any()),

    // Error fields
    errorType: v.optional(v.string()),
    errorMessage: v.optional(v.string()),

    // Unstructured metadata for this event
    metadata: v.optional(v.any()),

    createdAt: v.number(),
  })),

  // Unstructured metadata for the conversation
  metadata: v.optional(v.any()),

  createdAt: v.number(),
  updatedAt: v.number(),
  lastEventAt: v.number(),
})
  .index("by_agent_lastEvent", ["agentId", "lastEventAt"])
  .index("by_tenant_lastEvent", ["tenantId", "lastEventAt"])
  .index("by_session", ["tenantId", "agentId", "sessionId", "lastEventAt"])
  .index("by_user", ["tenantId", "agentId", "userId", "lastEventAt"]),
```

### Event Types

| Type | Description | Key Fields |
|------|-------------|------------|
| `message` | User, assistant, or system message | `role`, `content`, `model`, `providerResponseId` |
| `tool_call` | Tool invocation by the model | `toolName`, `toolCallId`, `toolInput` |
| `tool_result` | Tool execution result | `toolName`, `toolCallId`, `toolResult` |
| `system` | Internal events (context truncation, etc.) | `content`, `metadata` |
| `error` | Model errors, rate limits, failures | `errorType`, `errorMessage` |

### Trade-offs: Single Table vs Separate Tables

**Single table (chosen):**
- ✅ Simpler queries - one fetch gets everything
- ✅ Atomic updates - no cross-table consistency issues
- ✅ Easier pagination at conversation level
- ⚠️ Document size limit (~1MB in Convex)
- ⚠️ Can't index individual events

**Separate tables (alternative):**
- ✅ No document size concerns
- ✅ Can index events by type, tool, etc.
- ⚠️ Multiple queries to load a conversation
- ⚠️ Cross-table consistency requires care

**Mitigation for document size**: Archive old events or summarize long conversations (Phase 4).

## Data Flow

### 1. Create Conversation

1. Widget calls `POST /api/chats` with `{ agentId, sessionId, context? }`
2. Backend validates request → gets `tenantId` from agent config
3. Backend calls Convex `conversations.create({ agentId, sessionId, context })`
4. Returns `{ chatId }` to widget

### 2. Fetch Conversation History

1. Widget calls `GET /api/chats/:chatId`
2. Backend validates request → `tenantId`
3. Backend calls Convex `conversations.get({ agentId, conversationId })`
4. Returns conversation with events (404 if not found or access denied)

### 3. Send Message + Stream Response

1. Widget sends `POST /api/chats/:chatId/messages` with `{ content }`
2. Backend:
   - Fetches conversation from Convex
   - Appends user message event
   - Calls `runAgent` with `previousResponseId` from conversation
   - Streams tokens to client
   - On each tool call: appends `tool_call` event
   - On each tool result: appends `tool_result` event
   - On completion: appends assistant message event, updates `lastResponseId`
3. Widget receives `done` event → refetches canonical history

## Convex Functions

### Mutations

| Function | Args | Description |
|----------|------|-------------|
| `conversations.create` | `agentId, sessionId, title?, context?, metadata?` | Create new conversation |
| `conversations.appendEvent` | `agentId, conversationId, event` | Add event, update timestamps |
| `conversations.appendEvents` | `agentId, conversationId, events[]` | Batch append multiple events |
| `conversations.updateLastResponseId` | `agentId, conversationId, responseId` | Update provider state |
| `conversations.archive` | `agentId, conversationId` | Set status to archived |

### Queries

| Function | Args | Description |
|----------|------|-------------|
| `conversations.get` | `agentId, conversationId` | Get conversation with all events |
| `conversations.listBySession` | `agentId, sessionId, limit?` | List conversations for anonymous user |
| `conversations.listByUser` | `agentId, userId, limit?` | List conversations for authenticated user |
| `conversations.listByAgent` | `agentId, limit?` | List all conversations (dashboard) |

### Security in Convex Functions

```ts
async function validateAccess(ctx, agentId: string, conversationId: Id<"conversations">) {
  // Get agent to derive tenantId
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_agent_id", q => q.eq("agentId", agentId))
    .first();
  if (!agent) throw new Error("Agent not found");

  // Get conversation and verify ownership
  const conversation = await ctx.db.get(conversationId);
  if (!conversation) throw new Error("Conversation not found");
  
  if (conversation.tenantId !== agent.tenantId || 
      conversation.agentId !== agent._id) {
    throw new Error("Access denied");
  }

  return { agent, conversation };
}
```

## Implementation Phases

### Phase 1: Core Storage (MVP) ✅

Minimal implementation for conversation persistence with events.

| # | Task | Description | Status |
|---|------|-------------|--------|
| 1.1 | Schema | Add `conversations` table to Convex schema with events array | ✅ |
| 1.2 | Create mutation | `conversations.create` - create conversation with empty events | ✅ |
| 1.3 | Append mutation | `conversations.appendEvent` - add event, bump timestamps | ✅ |
| 1.4 | Get query | `conversations.get` - fetch conversation with events | ✅ |
| 1.5 | List query | `conversations.listBySession` - list by sessionId | ✅ |
| 1.6 | Worker: create | Update `POST /api/chats` to create in Convex | ✅ |
| 1.7 | Worker: fetch | Update `GET /api/chats/:chatId` to fetch from Convex | ✅ |
| 1.8 | Worker: messages | Update streaming endpoint to persist events | ✅ |
| 1.9 | Widget: sessionId | Generate/store `sessionId` in localStorage | ✅ |
| 1.10 | Widget: context | Send context (pageUrl, etc.) on chat creation | ✅ |

**Deliverable**: Conversations persist across page refreshes.

### Phase 2: Tool Events + History UI

| # | Task | Description |
|---|------|-------------|
| 2.1 | Tool call events | Persist `tool_call` events when agent invokes tools |
| 2.2 | Tool result events | Persist `tool_result` events after tool execution |
| 2.3 | Error events | Persist `error` events for failures |
| 2.4 | Widget: chat list | UI to list and restore previous conversations |
| 2.5 | Widget: delete | Allow users to delete their conversations |
| 2.6 | Widget: new chat | Button to start fresh conversation |

**Deliverable**: Full event history visible; users can manage conversations.

### Phase 3: Authentication Integration

| # | Task | Description |
|---|------|-------------|
| 3.1 | User ownership | Populate `userId` from Clerk on conversation create |
| 3.2 | List by user | `conversations.listByUser` query |
| 3.3 | Cross-device | Authenticated users see chats on any device |
| 3.4 | Session merge | Optional: merge anonymous chats to user on login |

**Deliverable**: Authenticated users have persistent chat history.

### Phase 4: Dashboard & Analytics

| # | Task | Description |
|---|------|-------------|
| 4.1 | Dashboard: list | View all conversations for an agent |
| 4.2 | Dashboard: viewer | Read-only transcript viewer |
| 4.3 | Dashboard: search | Search conversations by content |
| 4.4 | Analytics: usage | Token usage per conversation |
| 4.5 | Context injection | UI to configure what context goes into prompts |

**Deliverable**: Tenant admins can view and analyze conversations.

### Phase 5: Scale & Advanced Features (Future)

| # | Task | Description |
|---|------|-------------|
| 5.1 | Summarization | Periodic summaries for long conversations |
| 5.2 | Archival | Move old events to cold storage |
| 5.3 | Export | Export conversation history as JSON/CSV |
| 5.4 | Branching | Fork conversations from any point |

## Worker Integration

### Create Conversation

```ts
// POST /api/chats
app.post('/api/chats', async (c) => {
  const agentId = c.get('agentId');
  const body = await c.req.json().catch(() => ({}));

  const conversationId = await convex.mutation('conversations:create', {
    agentId,
    sessionId: body.sessionId,
    title: body.title,
    context: body.context,
  });

  return c.json({ id: conversationId }, 201);
});
```

### Stream with Event Persistence

```ts
// Inside runAgentTanStackSSE
async function onToolCall(toolName, toolCallId, input) {
  await convex.mutation('conversations:appendEvent', {
    agentId,
    conversationId,
    event: {
      eventType: 'tool_call',
      toolName,
      toolCallId,
      toolInput: input,
    },
  });
}

async function onToolResult(toolName, toolCallId, result) {
  await convex.mutation('conversations:appendEvent', {
    agentId,
    conversationId,
    event: {
      eventType: 'tool_result',
      toolName,
      toolCallId,
      toolResult: result,
    },
  });
}

async function onComplete(content, responseId, model) {
  await convex.mutation('conversations:appendEvent', {
    agentId,
    conversationId,
    event: {
      eventType: 'message',
      role: 'assistant',
      content,
      model,
      providerResponseId: responseId,
    },
  });
}
```

## Context Injection

Agent configs can opt-in to inject client context into the system prompt.

### Agent Config Field

```ts
contextInjection: v.optional(v.object({
  includePageUrl: v.optional(v.boolean()),
  includeLocale: v.optional(v.boolean()),
  includeTimezone: v.optional(v.boolean()),
  includeCustomMetadata: v.optional(v.boolean()),
  template: v.optional(v.string()),
})),
```

### Implementation

```ts
function buildSystemPrompt(agentConfig, conversationContext) {
  let prompt = agentConfig.systemPrompt;
  
  if (agentConfig.contextInjection && conversationContext) {
    const parts = [];
    const ctx = conversationContext;
    
    if (agentConfig.contextInjection.includePageUrl && ctx.pageUrl) {
      parts.push(`Current page: ${ctx.pageUrl}`);
    }
    if (agentConfig.contextInjection.includeLocale && ctx.locale) {
      parts.push(`Locale: ${ctx.locale}`);
    }
    // ... other fields
    
    if (parts.length > 0) {
      prompt += `\n\n---\nUser Context:\n${parts.map(p => `- ${p}`).join('\n')}`;
    }
  }
  
  return prompt;
}
```

## Event Format: Canonical vs LLM-Native

### Decision: Use Canonical (Custom) Format

We store events in our own provider-agnostic format, not LLM-native format.

**Why:**
- **Provider independence**: OpenAI, Anthropic, Google have different message formats
- **Stable schema**: LLM formats are moving targets (e.g., OpenAI function-calls → tools)
- **Better analytics**: Query directly by `eventType`, `toolName` without parsing
- **App-specific metadata**: Store UI state, timestamps, tenant info the LLM doesn't need
- **Multi-provider support**: Same conversation can be sent to different models

**Trade-off:** Requires adapter functions to convert to LLM format at request time. This cost is negligible vs LLM latency.

### Canonical Event Format

```ts
type Role = "user" | "assistant" | "system" | "tool";

type MessageEvent = {
  eventType: "message";
  role: Role;
  content: string;
  model?: string;
  providerResponseId?: string;
  metadata?: Record<string, unknown>;
};

type ToolCallEvent = {
  eventType: "tool_call";
  toolCallId: string;
  toolName: string;
  toolInput: unknown;  // JSON
};

type ToolResultEvent = {
  eventType: "tool_result";
  toolCallId: string;
  toolName: string;
  toolResult: unknown;  // JSON
};

type ConversationEvent = MessageEvent | ToolCallEvent | ToolResultEvent;
```

### LLM Format Adapter

Convert canonical events to provider-specific format at request time:

```ts
// worker/src/adapters/openai.ts
import type { ChatCompletionMessageParam } from 'openai/resources/chat';

export function toOpenAIMessages(
  events: ConversationEvent[]
): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [];

  for (const event of events) {
    switch (event.eventType) {
      case 'message':
        messages.push({
          role: event.role as 'user' | 'assistant' | 'system',
          content: event.content,
        });
        break;

      case 'tool_call':
        // Find or create assistant message with tool_calls
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === 'assistant' && 'tool_calls' in lastMsg) {
          lastMsg.tool_calls!.push({
            id: event.toolCallId,
            type: 'function',
            function: {
              name: event.toolName,
              arguments: JSON.stringify(event.toolInput),
            },
          });
        } else {
          messages.push({
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: event.toolCallId,
              type: 'function',
              function: {
                name: event.toolName,
                arguments: JSON.stringify(event.toolInput),
              },
            }],
          });
        }
        break;

      case 'tool_result':
        messages.push({
          role: 'tool',
          tool_call_id: event.toolCallId,
          content: JSON.stringify(event.toolResult),
        });
        break;
    }
  }

  return messages;
}
```

### Reconstruction Flow

On each new user message:

1. Load `events[]` from Convex for the conversation
2. Convert via `toOpenAIMessages(events)` (or other provider adapter)
3. Send to LLM via TanStack AI / OpenRouter
4. Map response back to canonical events:
   - Assistant content → `MessageEvent { role: "assistant" }`
   - Tool calls → `ToolCallEvent`
   - Tool outputs → `ToolResultEvent`
5. Persist new canonical events to Convex

### Optional: Raw Provider Logs

For debugging, optionally store raw LLM request/response payloads:

```ts
providerLogs: defineTable({
  tenantId: v.id("tenants"),
  conversationId: v.id("conversations"),
  provider: v.string(),      // "openai", "anthropic"
  model: v.string(),
  requestPayload: v.any(),   // What we sent
  responsePayload: v.any(),  // What we received
  latencyMs: v.number(),
  createdAt: v.number(),
})
  .index("by_conversation", ["conversationId", "createdAt"]),
```

Use only for debugging, not as source of truth.

## Future Considerations

- **Token usage tracking**: Add `usage` metadata per assistant message
- **Conversation branching**: Track parent-child `responseId` relationships
- **Long conversation summarization**: Periodic summarization for context management
- **Message status**: Add `status` field for failed/incomplete messages
- **Session-to-user merge**: Link anonymous chats to user account on login
- **Document size monitoring**: Alert when conversations approach size limits
- **Multi-provider adapters**: Add `toAnthropicMessages()`, etc. as needed
