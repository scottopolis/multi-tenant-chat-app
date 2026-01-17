# Conversation History

How conversations are stored, retrieved, and displayed across the system.

## Overview

Conversations are the core data structure for chat interactions. They're stored in Convex as the single source of truth, with the Worker acting as the API layer and the Widget providing the user interface.

**Key principle**: Convex owns all conversation data. The Worker persists events during streaming, and clients always fetch the canonical state from Convex after operations complete.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Widget    │────▶│   Worker    │────▶│   Convex    │
│  (React)    │◀────│ (CF Worker) │◀────│ (Database)  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Dashboard  │
                    │  (TanStack) │
                    └─────────────┘
```

## Data Model

### Conversations Table

Each conversation is a single document containing metadata and an embedded events array. This "single table" design keeps related data together and simplifies queries.

**File**: `convex-backend/convex/schema.ts` (conversations table definition)

A conversation includes:

- **Tenant isolation**: `tenantId` and `agentId` for multi-tenant security
- **Ownership**: `sessionId` (always present) and optional `userId` for authenticated users
- **Provider tracking**: `lastResponseId` for LLM conversation continuity
- **Client context**: Page URL, locale, timezone captured at creation
- **Events array**: All messages, tool calls, and errors in sequence

### Event Types

Events are stored in a provider-agnostic "canonical" format, not raw LLM responses.

| Type | Purpose | Key Fields |
|------|---------|------------|
| `message` | User, assistant, or system messages | `role`, `content`, `model` |
| `tool_call` | When the assistant invokes a tool | `toolName`, `toolCallId`, `toolInput` |
| `tool_result` | Result returned from tool execution | `toolName`, `toolCallId`, `toolResult` |
| `error` | Failures during processing | `errorType`, `errorMessage` |
| `system` | Internal events (context truncation, etc.) | `content`, `metadata` |

**File**: `convex-backend/convex/conversations.ts` (event validators and mutations)

## Session Management

Anonymous users are identified by a `sessionId` stored in the browser's localStorage. This allows conversation restoration within the same browser without requiring authentication.

**File**: `widget/src/lib/session.ts`

- `getSessionId()`: Returns existing ID or generates a new UUID
- Persisted in localStorage under `chat-assistant-session-id`
- Sent with every API request to identify the user

## Data Flow

### Creating a Conversation

1. Widget calls `POST /api/chats` with `agentId` and `sessionId`
2. Worker looks up the agent in Convex to get `tenantId`
3. Worker calls `conversations:create` mutation
4. Returns conversation ID to widget

**Files**:
- `widget/src/lib/api.ts` (`createChat` function)
- `worker/src/index.ts` (POST `/api/chats` handler)
- `convex-backend/convex/conversations.ts` (`create` mutation)

### Sending a Message

1. Widget calls `POST /api/chats/:chatId/messages`
2. Worker appends user message event to Convex
3. Worker streams LLM response to widget
4. During streaming, worker persists tool call/result events
5. On completion, worker appends assistant message event
6. Widget refetches conversation to get canonical state

**Files**:
- `widget/src/hooks/useChat.ts` (`sendMessage` function)
- `worker/src/index.ts` (POST `/api/chats/:chatId/messages` handler)
- `worker/src/agents/tanstack.ts` (streaming with event persistence)

### Loading History

Widget fetches conversation list on mount, filtered by `sessionId`:

1. Widget calls `GET /api/chats?sessionId=xxx`
2. Worker queries `conversations:listBySession`
3. Returns list with preview info (title, message count, last activity)

**Files**:
- `widget/src/lib/api.ts` (`listChats` function)
- `widget/src/components/ChatList.tsx` (UI component)
- `convex-backend/convex/conversations.ts` (`listBySession` query)

## Dashboard Access

Tenant admins can view all conversations for their agents through the dashboard.

### Conversation List

Shows all conversations across agents with:
- Message preview (first user message)
- Agent name
- Message count
- Last activity timestamp

**Files**:
- `dashboard/src/routes/_authed.dashboard/conversations/index.tsx`
- `dashboard/src/lib/conversations.ts` (helper utilities)
- `convex-backend/convex/conversations.ts` (`listByTenant` query)

### Transcript Viewer

Read-only view showing the full conversation with:
- All event types rendered (messages, tool calls, results, errors)
- Metadata panel (session ID, user ID, context, timestamps)
- Color-coded bubbles by event type

**Files**:
- `dashboard/src/routes/_authed.dashboard/conversations/$conversationId.tsx`
- `convex-backend/convex/conversations.ts` (`getForDashboard` query)

## Security Model

### Access Control

All conversation access is scoped by tenant. The system never trusts client-provided `tenantId`.

| Action | Who Can Access | Validation |
|--------|----------------|------------|
| Create | Anyone with valid API key | Agent lookup derives `tenantId` |
| Read/Write | Conversation owner | Session ID or user ID match |
| List (widget) | Same browser session | Session ID filter |
| List (dashboard) | Tenant admins | Clerk auth + tenant ownership |

**File**: `convex-backend/convex/conversations.ts` (`validateAccess` function)

### Widget Access

The widget uses API key authentication. For listing conversations:

- **Anonymous users**: Filtered by `sessionId` (stored in localStorage)
- **Authenticated users**: Filtered by `userId` (passed from tenant's site)

### Dashboard Access

The dashboard uses Clerk authentication. All queries are scoped to the logged-in tenant's conversations only.

## LLM Format Conversion

Events are stored in canonical format but converted to provider-specific format when sending to the LLM.

**Why canonical format**:
- Provider independence (OpenAI, Anthropic, etc. have different formats)
- Stable schema (LLM formats change frequently)
- Better analytics (can query by `eventType`, `toolName` directly)
- App-specific metadata (timestamps, tenant info)

**File**: `worker/src/adapters/openai.ts` (converts canonical events to OpenAI message format)

## Client Context

When creating a conversation, the widget captures context about the user's environment:

- Page URL where the widget is embedded
- Referrer URL
- Browser locale and timezone
- Custom metadata (tenant-provided)

This context can be injected into the system prompt (opt-in per agent) for personalized responses.

**Files**:
- `widget/src/lib/session.ts` (`getClientContext` function)
- `widget/src/lib/api.ts` (sends context in create request)

## Limitations

### Document Size

Convex documents have a ~1MB limit. Very long conversations may hit this limit. Future mitigation options:

- Archive old events to separate storage
- Periodic summarization of long conversations
- Split events into a separate table

### No Real-Time Sync

The widget uses polling/refetch after operations rather than real-time subscriptions. This keeps the implementation simple but means other browser tabs won't see updates instantly.

## Related Documentation

- `specs/conversation-history-storage.md` - Detailed technical specification
- `docs/api-reference.md` - Worker API endpoints
- `docs/widget.md` - Widget embedding guide
