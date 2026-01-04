# Conversation History Storage Spec

Store conversation history in Convex for the multi-tenant chat assistant.

## Overview

- **Source of truth**: Convex database
- **Conversation continuity**: OpenAI Agents SDK `previousResponseId` stored per conversation
- **Multi-tenant isolation**: All queries filtered by `tenantId`
- **Ownership**: Conversations owned by `userId` (authenticated) or `sessionId` (anonymous)
- **Streaming**: Server persists final content only; widget handles streaming UX

## Security Principles

### Client vs Server Responsibilities

| Source | Fields | Purpose |
|--------|--------|---------|
| **Client sends** | `sessionId`, `userId?`, `pageUrl`, `referrer`, `userAgent`, `locale`, `timezone`, `customMetadata` | User context for analytics & optional prompt injection |
| **Server owns** (from Convex) | `systemPrompt`, `model`, `tools`, `temperature`, `outputSchema` | Agent behavior - never from client |

### Ownership Rules

- **Anonymous users**: `sessionId` stored in localStorage, conversation has `userId: null`
- **Authenticated users**: `userId` from Clerk, can access chats across devices
- **Query logic**: 
  - Authenticated: `WHERE userId = :userId`
  - Anonymous: `WHERE sessionId = :sessionId AND userId IS NULL`
- **Optional**: Merge anonymous chats to user account on login

## Schema Design

### conversations table

```ts
defineTable("conversations", {
  tenantId: v.id("tenants"),
  agentId: v.string(),
  
  // Ownership
  userId: v.optional(v.string()),    // Clerk user ID (null for anonymous)
  sessionId: v.string(),             // Always present, from localStorage
  
  // Client context (captured at creation, for analytics & prompt injection)
  context: v.optional(v.object({
    pageUrl: v.optional(v.string()),
    referrer: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    locale: v.optional(v.string()),
    timezone: v.optional(v.string()),
    customMetadata: v.optional(v.any()), // From embed script data attributes
  })),
  
  title: v.optional(v.string()),
  lastResponseId: v.optional(v.string()), // OpenAI Agents SDK continuity
  lastMessageAt: v.number(),
  
  createdAt: v.number(),
  updatedAt: v.number(),
  metadata: v.optional(v.any()),
})
  .index("by_tenant_agent", ["tenantId", "agentId"])
  .index("by_tenant_agent_lastMessageAt", ["tenantId", "agentId", "lastMessageAt"])
  .index("by_user", ["tenantId", "agentId", "userId", "lastMessageAt"])
  .index("by_session", ["tenantId", "agentId", "sessionId", "lastMessageAt"]);
```

### messages table

```ts
defineTable("messages", {
  tenantId: v.id("tenants"),
  agentId: v.string(),
  conversationId: v.id("conversations"),
  
  role: v.union(
    v.literal("user"),
    v.literal("assistant"),
    v.literal("system"),
    v.literal("tool"),
  ),
  content: v.string(),
  sequence: v.number(), // Monotonic ordering per conversation
  
  responseId: v.optional(v.string()), // For assistant messages
  model: v.optional(v.string()),
  createdAt: v.number(),
  metadata: v.optional(v.any()),
})
  .index("by_conversation_seq", ["conversationId", "sequence"])
  .index("by_tenant_conversation", ["tenantId", "conversationId"]);
```

## Data Flow

### 1. Create Conversation

1. Widget calls `POST /api/chat` with `{ agentId, apiKey }`
2. Backend validates apiKey → gets `tenantId`
3. Backend calls Convex `conversations.create({ tenantId, agentId })`
4. Returns `{ chatId: conversationId }` to widget

### 2. Fetch Conversation History

1. Widget calls `getChat(chatId, agentId)` via TanStack Query
2. Backend validates apiKey → `tenantId`
3. Backend calls Convex `conversations.getWithMessages({ tenantId, agentId, conversationId })`
4. Returns `{ chatId, messages }` (404 if not found → triggers `onChatNotFound`)

### 3. Send Message + Stream Response

1. `useChat.sendMessage(content)` optimistically adds user + placeholder assistant message
2. Backend `POST /api/chat/:chatId/stream`:
   - Validates apiKey → `tenantId`
   - Looks up conversation → gets `previousResponseId`
   - Persists user message via `messages.appendUser`
   - Calls `runAgent({ previousResponseId, ... })`
   - Streams tokens to client
   - On completion: calls `messages.appendAssistantAndUpdateConversation` with final content + `lastResponseId`
3. Widget receives `done` event → invalidates query → refetches canonical history

## Convex Functions

### Mutations

| Function | Args | Description |
|----------|------|-------------|
| `conversations.create` | `tenantId, agentId, title?` | Create new conversation |
| `messages.appendUser` | `tenantId, agentId, conversationId, content` | Add user message, update timestamps |
| `messages.appendAssistantAndUpdateConversation` | `tenantId, agentId, conversationId, content, responseId?, model?` | Add assistant message, update `lastResponseId` |

### Queries

| Function | Args | Description |
|----------|------|-------------|
| `conversations.getWithMessages` | `tenantId, agentId, conversationId` | Get conversation + all messages ordered by sequence |
| `conversations.listByAgent` | `tenantId, agentId, limit?` | List recent conversations for an agent |

## Integration Points

### Worker (Backend)

- **`POST /api/chat`**: Create conversation in Convex
- **`GET /api/chat/:chatId`**: Fetch conversation + messages from Convex
- **`POST /api/chat/:chatId/stream`**: 
  - Get `previousResponseId` from `conversation.lastResponseId`
  - Persist user message before calling `runAgent`
  - Persist assistant message + update `lastResponseId` on completion

### Widget (Frontend)

- **Chat creation**: Parent component creates chat before rendering `useChat`
- **No changes to streaming UX**: `useChat` continues optimistic updates + invalidation
- **Multi-tenant**: Widget only knows `agentId` + `chatId`; tenancy enforced server-side

## Security

- All Convex queries/mutations require `tenantId`
- Always verify `conversation.tenantId === requestingTenantId`
- Never trust `previousResponseId` from client; derive from Convex

## Implementation Phases

### Phase 1: Core Storage (sessionId only)

Minimal implementation for conversation persistence without authentication.

| Task | Description |
|------|-------------|
| 1.1 | Add `conversations` and `messages` tables to Convex schema |
| 1.2 | Implement Convex mutations: `conversations.create`, `messages.appendUser`, `messages.appendAssistantAndUpdateConversation` |
| 1.3 | Implement Convex queries: `conversations.getWithMessages`, `conversations.listBySession` |
| 1.4 | Update worker `POST /api/chat` to create conversations in Convex |
| 1.5 | Update worker `GET /api/chat/:chatId` to fetch from Convex |
| 1.6 | Update worker streaming endpoint to persist messages and use stored `previousResponseId` |
| 1.7 | Widget: generate/store `sessionId` in localStorage |
| 1.8 | Widget: send `sessionId` + context (pageUrl, etc.) on chat creation |
| 1.9 | Widget: conversation list UI (list + restore previous chats) |
| 1.10 | Widget: delete conversation |

**Ownership in Phase 1:**
- All conversations owned by `sessionId`
- `userId` field exists but is always `null`
- Query by `sessionId` only

### Phase 2: Authentication Integration

Add user ownership after Clerk auth is implemented.

| Task | Description |
|------|-------------|
| 2.1 | Populate `userId` from Clerk session on conversation create |
| 2.2 | Add `conversations.listByUser` query |
| 2.3 | Update ownership query logic (authenticated vs anonymous) |
| 2.4 | Cross-device sync for authenticated users |
| 2.5 | Optional: merge anonymous chats to user on login |

### Phase 3: Dashboard & Analytics

| Task | Description |
|------|-------------|
| 3.1 | Dashboard: view all conversations for an agent |
| 3.2 | Dashboard: conversation transcript viewer |
| 3.3 | Analytics: token usage per conversation |
| 3.4 | Context injection configuration UI |

### Phase 4: Advanced Features (Future)

| Task | Description |
|------|-------------|
| 4.1 | Conversation summarization for long chats |
| 4.2 | Conversation branching (fork from any point) |
| 4.3 | Export conversation history |
| 4.4 | Conversation search |

## Context Injection

Agent configs can opt-in to inject client context into the system prompt.

### Agent Config Field

```ts
// In agents table
contextInjection: v.optional(v.object({
  includePageUrl: v.optional(v.boolean()),
  includeLocale: v.optional(v.boolean()),
  includeTimezone: v.optional(v.boolean()),
  includeCustomMetadata: v.optional(v.boolean()),
  template: v.optional(v.string()), // Custom template for injection
})),
```

### Default Injection Template

When enabled, append to system prompt:

```
---
User Context:
- Current page: {pageUrl}
- Locale: {locale}
- Timezone: {timezone}
- Custom data: {customMetadata}
```

### Implementation

```ts
function buildSystemPrompt(agentConfig, conversationContext) {
  let prompt = agentConfig.systemPrompt;
  
  if (agentConfig.contextInjection) {
    const ctx = conversationContext;
    const parts = [];
    
    if (agentConfig.contextInjection.includePageUrl && ctx.pageUrl) {
      parts.push(`Current page: ${ctx.pageUrl}`);
    }
    // ... other fields
    
    if (parts.length > 0) {
      prompt += `\n\n---\nUser Context:\n${parts.map(p => `- ${p}`).join('\n')}`;
    }
  }
  
  return prompt;
}
```

## Future Considerations

- **Token usage tracking**: Add `usage` metadata per assistant message
- **Conversation branching**: Track parent-child `responseId` relationships
- **Long conversation summarization**: Periodic summarization for context management
- **Message status**: Add `status` field for failed/incomplete messages
- **Session-to-user merge**: Link anonymous chats to user account on login
