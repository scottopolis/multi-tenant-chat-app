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


---

## Next Up

Read specs/widget-security.md

### 1. TanStack AI SDK Migration

DONE

### 2. Convex RAG Migration

DONE

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
