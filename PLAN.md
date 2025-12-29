# Multi-Tenant Chat Assistant - Project Plan

## Overview

Multi-tenant chat assistant SaaS platform:
- **Widget**: Embeddable React chat component (SSE streaming, structured output)
- **Worker**: Cloudflare Worker backend (Hono + OpenAI Agents SDK)
- **Dashboard**: TanStack Start web app for tenant configuration
- **Convex**: Database for tenant configs, chat history, and RAG

See [DATABASE.md](DATABASE.md) for database implementation details.

---

## Current State

- Widget with real-time streaming chat, structured output, suggestions
- Worker with OpenAI Agents SDK, tool calling, MCP support
- Dashboard (TanStack Start + shadcn/ui)
- Convex database integrated
- Unit tests (Vitest) and E2E tests (Playwright)

---

## Next Up

### Authentication (Convex Auth)
- [ ] Set up Convex Auth
- [ ] Protect dashboard routes
- [ ] Tenant isolation in queries

### Conversation History Storage
- [ ] Store messages in Convex
- [ ] Load history on chat open
- [ ] Persist across sessions

### Widget Embed Code
- [ ] Generate embed snippet in dashboard
- [ ] API key display/copy
- [ ] Customization options (theme, position)

---

## Later Phases

### Evals (Langfuse)
- [ ] Set up Langfuse integration
- [ ] Create eval datasets
- [ ] Build eval runner

### RAG Knowledgebase
- [ ] Document upload in dashboard
- [ ] Vector embeddings in Convex
- [ ] Retrieval-augmented generation in worker

### Future
- Agent handoffs
- Voice agents (Realtime API)
- Human-in-the-loop approval flows
- Analytics & billing

---

## Architecture

```
End Users → Widget/Voice → Cloudflare Worker → OpenAI API
                              ↓
                           Convex (configs, history, vectors)
                              ↑
                         Dashboard (TanStack Start)
```

---

## Open Questions

- Embedding model for RAG?
- Self-hosted vs cloud Langfuse?

---

*Last updated: December 2024*
