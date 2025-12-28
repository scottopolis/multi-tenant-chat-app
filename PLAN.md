# Multi-Tenant Chat Assistant - Project Plan

## Overview

This project is a multi-tenant chat assistant SaaS platform with:
- **Widget**: Embeddable React chat component for end-users
- **Worker**: Cloudflare Worker backend (API + AI orchestration)
- **Dashboard**: TanStack Start web app for tenant configuration
- **Evals**: Langfuse-powered evaluation system

---

## Current State (Completed)

### ✅ Widget (React + Vite)
- Real-time streaming chat with SSE
- TanStack Query for data fetching
- shadcn/ui + Tailwind styling
- Agent routing via `?agent=<id>` query param

### ✅ Worker (Cloudflare Workers + Hono)
- OpenRouter integration for LLM access
- Tool/function calling (built-in + webhook)
- MCP server support for external tools
- In-memory storage (placeholder)
- Langfuse integration (prepared)
- Tenant config types defined

### ✅ Testing
- Unit tests with Vitest
- E2E tests with Playwright

---

See DATABASE.md for convex and D1 implementation details.

## Phase 1: Dashboard Web App

**Goal**: Create a web application where tenants can sign up, configure agents, and manage settings.

### Tech Stack
- **Framework**: TanStack Start (React + file-based routing)
- **Auth**: Clerk (deferred)
- **UI**: shadcn/ui + Tailwind CSS
- **Data**: TanStack Query
- **Deploy**: Vercel

### Phase 1A: MVP (Current Implementation)
**Implementing Now:**
- Landing page (simple)
- Dashboard layout with navigation
- Agent list page (CRUD operations)
- Agent configuration: System prompt editor only

**Pages:**
```
/                       - Landing page
/dashboard              - Dashboard home
/dashboard/agents       - List agents
/dashboard/agents/new   - Create new agent
/dashboard/agents/[id]  - Edit agent (prompt only)
```

**Deferred to Phase 1B:**
- Clerk authentication (sign up, sign in, org management)
- Dashboard home with usage overview
- Agent configuration advanced features:
  - Model selection
  - MCP server connections
  - Webhook tool configuration
- API key management
- Widget embed code generator
- Account settings page

---

## Phase 2: Database & Persistence

**Goal**: Replace in-memory storage with a real database for tenant configs, chat history, and document embeddings.

### Recommended: Hybrid Approach (Convex + D1)

Use both databases, each for what they do best:

**Convex** (cold path - infrequent reads/writes):
- Tenant configs and agent settings
- API keys
- Documents and file storage
- Vector embeddings for RAG
- Real-time dashboard updates

**Cloudflare D1** (hot path - frequent reads/writes):
- Chat sessions and messages
- Native to Workers = lowest latency
- SQLite, simple and fast

This hybrid approach optimizes for latency on the hot path (conversations) while leveraging Convex's richer features for configuration and RAG.

### Data Models

**In Convex:**
- **Tenants**: Organization settings, billing tier
- **Agents**: Per-tenant agent configurations
- **API Keys**: Tenant API keys for widget auth
- **Documents**: Uploaded files per tenant
- **Embeddings**: Vector chunks for RAG knowledgebase

**In D1:**
- **Chats**: Chat sessions (id, org_id, title, created_at)
- **Messages**: Chat messages (id, chat_id, role, content, created_at)
- searchable by org_id or conversation_id

### Document Processing Pipeline
```
Upload Doc → Store in Convex Files → Chunk Text → Generate Embeddings → Store Vectors
                                                          ↓
                              Agent Query → Vector Search → Retrieve Context → LLM Response
```

### Migration Strategy
1. Set up Convex project
2. Define schemas (tables + vector indexes)
3. Migrate worker storage layer to use Convex client
4. Add document upload + embedding pipeline
5. Update dashboard to read/write tenant configs

---

## Phase 3: Authentication

**Goal**: Secure the platform with proper authentication for both dashboard and widget.

### Dashboard Auth (Clerk)
- User authentication
- Organization management
- Role-based access (admin, member)
- SSO support (future)

### Widget Auth (API Keys)
- Tenants generate API keys in dashboard
- Widget passes API key in request header
- Worker validates key and extracts tenant ID
- Rate limiting per API key

### Worker Auth Flow
```
Widget Request → API Key Header → Validate Key → Extract Tenant → Load Config → Process
```

---

## Phase 4: Eval Runner

**Goal**: Automated testing of agent behavior with Langfuse integration.

### Components
- Eval runner script (Node.js or Cloudflare Worker)
- Test case definitions (prompt + expected behavior)
- Langfuse dataset integration
- Scoring and reporting

### Langfuse Integration
- Fetch test cases from Langfuse datasets
- Run agent against each test case
- Log traces back to Langfuse
- Compare outputs with expected results
- Generate scores (LLM-as-judge or rule-based)

### Eval Types
- **Regression tests**: Known prompts with expected outputs
- **Golden answers**: Compare against reference responses
- **Quality scores**: Helpfulness, accuracy, safety
- **Tool usage**: Verify correct tool invocation

---

## Phase 5: RAG Knowledgebase

**Goal**: Allow tenants to upload documents that power their agent's knowledge.

### Features
- Document upload UI in dashboard (PDF, TXT, MD, DOCX)
- Automatic text extraction and chunking
- Embedding generation (OpenAI or open-source model)
- Vector storage in Convex
- Retrieval-augmented generation in agent

### Dashboard UI
- Knowledge base section per agent
- Drag-and-drop document upload
- View/delete uploaded documents
- Processing status indicators
- Preview retrieved chunks (debug mode)

### Agent Integration
- Automatic context injection from relevant docs
- Source citations in responses
- Configurable retrieval settings (top-k, threshold)

---

## Phase 6: Advanced Features (Future)

### Analytics & Monitoring
- Chat analytics per tenant
- Cost tracking (tokens used)
- Performance metrics
- Error monitoring

### Billing
- Usage-based billing
- Plan tiers (free, pro, enterprise)
- Stripe integration

### Enterprise Features
- Custom domains for widget
- SSO/SAML authentication
- Audit logs
- Dedicated support

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         End Users                                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Embeddable Chat Widget                            │
│                    (React + Vite + shadcn)                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │ API Key Auth
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker API                             │
│                    (Hono + AI SDK + OpenRouter)                      │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Router    │  │   Agents    │  │    Tools    │  │  Storage   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐    ┌────────────────────────────────────┐
│         Convex            │    │           External Services         │
│                           │    │  ┌──────────┐  ┌─────────────────┐ │
│  • Tenant configs         │    │  │OpenRouter│  │  Langfuse       │ │
│  • Chat history           │    │  │   (LLM)  │  │  (Tracing/Eval) │ │
│  • API keys               │    │  └──────────┘  └─────────────────┘ │
│  • Documents (files)      │    │  ┌──────────┐  ┌─────────────────┐ │
│  • Vector embeddings      │    │  │MCP Server│  │  Webhooks       │ │
│                           │    │  │  (Tools) │  │  (Custom Tools) │ │
└───────────────────────────┘    │  └──────────┘  └─────────────────┘ │
                                 └────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         Tenant Dashboard                             │
│                    (TanStack Start + Clerk)                         │
│                         Deployed to Vercel                          │
│                                                                      │
│  • Sign up / Sign in                                                │
│  • Agent configuration                                              │
│  • API key management                                               │
│  • Widget embed code                                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure (Target)

```
multi-tenant-chat-assistant/
├── worker/              # Cloudflare Worker API (existing)
├── widget/              # Embeddable React widget (existing)
├── dashboard/           # TanStack Start web app (new)
│   ├── app/
│   │   ├── routes/      # File-based routing
│   │   ├── components/  # Shared components
│   │   └── lib/         # Utilities
│   └── ...
├── packages/            # Shared code (optional)
│   └── shared/          # Types, utils shared between apps
├── evals/               # Eval runner (new)
│   ├── src/
│   └── datasets/        # Test cases
└── docs/                # Documentation (existing)
```

---

## Implementation Order

1. **Phase 1**: Dashboard web app with Clerk auth
2. **Phase 2**: Database integration with Convex
3. **Phase 3**: Worker auth with API keys
4. **Phase 4**: Eval runner with Langfuse
5. **Phase 5**: RAG knowledgebase (document upload + vector search)
6. **Phase 6**: Advanced features as needed

---

## Open Questions

- [x] Which database? → **Hybrid: Convex (configs/RAG) + D1 (conversations)**
- [ ] Monorepo tooling? (Turborepo, pnpm workspaces)
- [ ] Shared types package or duplicate?
- [ ] Embedding model? (OpenAI text-embedding-3-small vs open-source)
- [ ] Chunk size and overlap for documents?
- [ ] Free tier limits for tenants?
- [ ] Self-hosted vs cloud Langfuse?

---

## Success Criteria

1. Tenants can sign up and configure agents via dashboard
2. Widget authenticates with API key
3. Tenant configs persist to Convex
4. Tenants can upload documents for agent knowledgebase
5. Agents use RAG to answer from uploaded docs
6. Evals run automatically on prompt changes
7. Full tracing in Langfuse for debugging

---

*Last updated: December 2024*

