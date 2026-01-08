# Multi-Tenant Chat Assistant - Project Plan

## Overview

Multi-tenant chat assistant SaaS platform:
- **Widget**: Embeddable React chat component (shadcn/ui, SSE streaming)
- **Worker**: Cloudflare Worker backend (Hono + TanStack AI SDK)
- **Dashboard**: TanStack Start web app for tenant configuration
- **Convex**: Database for tenant configs, chat history, and RAG

See [DATABASE.md](DATABASE.md) for database implementation details.

---

## Architecture Changes (In Progress)

### Migrate from OpenAI/Vercel AI SDK → TanStack AI SDK + OpenRouter

**Why:**
- Provider-agnostic: Switch between models without code changes
- Better type safety with full TypeScript inference
- Built-in agent loop strategies (`maxIterations`, `untilFinishReason`)
- Isomorphic tools: Define once, implement for server/client
- Native TanStack Start integration via `createServerFnTool`

**New Stack:**
```
Widget (React + shadcn/ui)
    ↓ SSE
Worker (Hono + TanStack AI)
    ↓
OpenRouter API (any model: Claude, GPT, Gemini, Llama, etc.)
    ↓
Convex (configs, history, vectors via @convex-dev/rag)
```

### Key Implementation Details

#### TanStack AI SDK Setup

```typescript
// packages/worker/src/lib/ai.ts
import { chat, maxIterations, toServerSentEventsResponse } from '@tanstack/ai'
import { createOpenaiChat } from '@tanstack/ai-openai'

// OpenRouter uses OpenAI-compatible API
const openrouter = createOpenaiChat(process.env.OPENROUTER_API_KEY!, {
  baseURL: 'https://openrouter.ai/api/v1',
})

// Use any model via OpenRouter
const stream = chat({
  adapter: openrouter('anthropic/claude-sonnet-4'),
  messages,
  tools: [searchKnowledge, ...tenantTools],
  agentLoopStrategy: maxIterations(10),
})

return toServerSentEventsResponse(stream)
```

#### Tool Definition Pattern

```typescript
// packages/worker/src/tools/search-knowledge.ts
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

const searchKnowledgeDef = toolDefinition({
  name: 'search_knowledge',
  description: 'Search the knowledge base for relevant information',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    limit: z.number().optional().default(5),
  }),
  outputSchema: z.object({
    results: z.array(z.object({
      text: z.string(),
      score: z.number(),
    })),
  }),
})

export const searchKnowledge = searchKnowledgeDef.server(async ({ query, limit }) => {
  // Call Convex RAG action
  const { results } = await convex.action(api.rag.search, { 
    namespace: tenantId,
    query,
    limit,
  })
  return { results }
})
```

#### Convex RAG Component

```typescript
// convex/convex.config.ts
import { defineApp } from 'convex/server'
import rag from '@convex-dev/rag/convex.config.js'

const app = defineApp()
app.use(rag)
export default app

// convex/rag.ts
import { components } from './_generated/api'
import { RAG } from '@convex-dev/rag'
import { openai } from '@ai-sdk/openai'

export const rag = new RAG(components.rag, {
  textEmbeddingModel: openai.embedding('text-embedding-3-small'),
  embeddingDimension: 1536,
  filterNames: ['tenantId', 'documentType'],
})
```

---

## Current State

- Widget with real-time streaming chat, structured output, suggestions
- Worker with OpenAI Agents SDK (migrating to TanStack AI)
- Dashboard (TanStack Start + shadcn/ui)
- Convex database integrated
- Unit tests (Vitest) and E2E tests (Playwright)

---

## Next Up

### 1. TanStack AI SDK Migration
See docs here: https://tanstack.com/ai/latest/docs/getting-started/overview
- [ ] Install TanStack AI packages (`@tanstack/ai`, `@tanstack/ai-openai`)
- [ ] Create OpenRouter adapter using OpenAI adapter with custom baseURL
- [ ] Migrate tool definitions to `toolDefinition()` pattern
- [ ] Implement agent loop with `maxIterations` strategy
- [ ] Update SSE streaming to use `toServerSentEventsResponse`

### 2. Convex RAG Migration
- [ ] Install `@convex-dev/rag` component
- [ ] Add RAG component to `convex.config.ts`
- [ ] Migrate embeddings to Convex vector search (replace OpenAI VectorStore)
- [ ] Update `search_knowledge` tool to use Convex RAG
- [ ] Add namespace support for tenant isolation

### 3. Widget UI Refresh (shadcn-style)
- [ ] Install shadcn-chat components or build custom
- [ ] Match chat-sdk.dev aesthetic:
  - Suggestion chips below input
  - Streaming with proper scroll management
  - Loading states and typing indicators
- [ ] Components needed:
  - `ChatContainer` - main layout with sidebar
  - `ChatMessages` - virtualized message list
  - `ChatInput` - textarea with file upload, model select
  - `ChatBubble` - message styling with avatar
  - `SuggestionChips` - quick action buttons

### 5. Conversation History Storage
- [ ] Store conversation history in Convex
- [ ] Load history on chat open
- [ ] Persist across sessions

---

## Later Phases

- use open router embedding model for convex RAG document upload, see convex-backend/convex/documents.ts

### Evals (Langfuse)
- [ ] Set up Langfuse integration
- [ ] Create eval datasets
- [ ] Build eval runner

### Future
- Agent handoffs
- Voice agents (Realtime API) - DONE
- Human-in-the-loop approval flows (TanStack AI has built-in support)
- Analytics & billing

---

## Architecture

```
End Users → Widget → Cloudflare Worker → OpenRouter → Any LLM
              ↓           ↓
           shadcn/ui   TanStack AI SDK
                          ↓
                       Convex
                       ├── Tenant configs
                       ├── Chat history
                       └── RAG (@convex-dev/rag)
                              ↑
                         Dashboard (TanStack Start)
```

---

## Package Dependencies

### Remove
- `openai` (agents SDK)
- `ai` (Vercel AI SDK)
- OpenAI VectorStore dependencies

### Add
- `@tanstack/ai` - Core SDK
- `@tanstack/ai-openai` - OpenAI-compatible adapter (for OpenRouter)
- `@tanstack/ai-react` - React hooks (useChat)
- `@convex-dev/rag` - Convex RAG component
- `shadcn-chat` or custom shadcn chat components

---

## Open Questions

- Self-hosted vs cloud Langfuse?
- Which shadcn chat component library? (shadcn-chat, shadcn-chatbot-kit, or custom)

---

*Last updated: January 2025*
