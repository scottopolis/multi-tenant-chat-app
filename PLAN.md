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
- OpenRouter integration for LLM access (migrating to OpenAI Agents SDK)
- Tool/function calling (built-in + webhook)
- MCP server support for external tools
- In-memory storage (placeholder)
- Langfuse integration (prepared)
- Tenant config types defined

### 🔄 Planned: OpenAI Agents SDK Migration
- Replace AI SDK + OpenRouter with OpenAI Agents SDK
- Native handoffs between agents
- Structured output support
- Voice agent preparation

### ✅ Testing
- Unit tests with Vitest
- E2E tests with Playwright

---

See DATABASE.md for convex and D1 implementation details.

---

## Phase 0: OpenAI Agents SDK Migration

**Goal**: Replace Vercel AI SDK + OpenRouter with OpenAI Agents SDK for native support of handoffs, structured output, voice agents, and advanced agent patterns.

### Why Migrate?

**Current Stack (AI SDK + OpenRouter):**
- ✅ Multi-model support via OpenRouter
- ✅ Streaming with `streamText`
- ✅ Basic tool calling
- ❌ No native handoffs (would need custom implementation)
- ❌ No native structured output mode
- ❌ No voice agent support
- ❌ No human-in-the-loop patterns

**OpenAI Agents SDK:**
- ✅ Native agent handoffs (transfer between agents)
- ✅ Built-in structured output via response format
- ✅ Voice agents via Realtime API
- ✅ Guardrails and input validation
- ✅ Tracing built-in
- ⚠️ OpenAI models only (trade-off for features)

### Migration Steps

#### Step 0.1: Environment & Dependencies ✅
- [x] Add `nodejs_compat` flag to `wrangler.toml` (required for SDK compatibility)
- [x] Ensure `compatibility_date` is `2024-09-23` or later (set to 2024-12-01)
- [x] Install `@openai/agents` (TypeScript SDK - correct package name)
- [x] `OPENAI_API_KEY` exists in env vars (confirmed in .dev.vars)
- [x] Remove `@openrouter/ai-sdk-provider` and `ai` packages (removed from package.json)
- [x] Test basic OpenAI API call works in Worker (test file created in src/openai.test.ts)

#### Step 0.2: Agent Definition Refactor ✅
- [x] Convert `runAgent()` to use Agents SDK `Agent` class
- [x] Define agents with `instructions`, `tools`, and `model`
- [x] Migrate built-in tools to Agents SDK tool format (added `name` field)
- [x] Update `AgentConfig` types for new SDK patterns
- [x] Update models list to OpenAI-only models
- [x] Update API key handling (OPENAI_API_KEY instead of OPENROUTER_API_KEY)

**Note:** Need to fix Agent.run() API usage - checking SDK documentation for correct method

#### Step 0.3: Tool Migration ✅
- [x] Convert `tool()` definitions to Agents SDK format (added `name` field to all tools)
- [x] Update `getTools()` to return array instead of object
- [x] Fixed optional parameters to use `.nullable().optional()` (OpenAI API requirement)
- [x] Migrate MCP integration - MCP tools now use `tool()` from Agents SDK
- [x] Fixed MCP tools return type (array instead of object)
- [x] Set API key globally with `setDefaultOpenAIKey()` before agent runs
- [x] Test tool calling with new SDK

**⚠️ Important: OpenAI API requires optional fields to be nullable**
```typescript
// ❌ Wrong - will cause runtime error
timezone: z.string().optional()

// ✅ Correct - must chain nullable() before optional()
timezone: z.string().nullable().optional()
```

**🔑 API Key Configuration**
Must call `setDefaultOpenAIKey(apiKey)` before creating/running agents:
```typescript
setDefaultOpenAIKey(apiKey);  // Required!
const agent = new Agent({ ... });
const result = await run(agent, input);
```

**🚧 MCP Integration Limitation in Cloudflare Workers**
The Agents SDK native MCP support (`Agent.mcpServers` + `MCPServerStdio`) uses stdio for subprocess communication, which **doesn't work in Cloudflare Workers** sandboxed environment. 

Our workaround: HTTP-based MCP client that fetches tools via HTTP and converts them to function tools. This works but doesn't support all MCP features (like resources, prompts).

Native approach (doesn't work in Workers):
```typescript
const server = new MCPServerStdio({ fullCommand: '...' });
await server.connect();
const agent = new Agent({ mcpServers: [server] }); // ❌ Won't work in Workers
```

Our HTTP workaround (works in Workers):
```typescript
const tools = await getTools(agentId); // Includes MCP tools via HTTP
const agent = new Agent({ tools }); // ✅ Works in Workers
```

#### Step 0.4: Streaming Response Update ✅
- [x] Replace `streamText` with Agents SDK streaming (`stream: true`)
- [x] Use `toTextStream()` to get text deltas from StreamedRunResult
- [x] Iterate over text stream with `for await` loop
- [x] Await `result.completed` promise for proper completion (critical!)
- [x] SSE event format unchanged - widget compatible
- [x] Fixed to use `result.finalOutput` for non-streaming mode

**Best Practices Applied:**
- ✅ Always `await result.completed` before exiting to flush output
- ✅ Use `toTextStream()` for text-only apps (simpler than raw events)
- 📝 Note: `stream: true` must be passed each time when using RunState

### Known Issues (Resolved ✅)

- ✅ **Test files updated** - Unit tests now expect array format for tools
- ✅ **Conversation history implemented** - Agent now receives full conversation history
  - Implemented local history approach (passing all messages to agent)
  - Added optional support for OpenAI Conversation API fields in storage
  - Storage tracks `conversationId` and `lastResponseId` for future server-side state management

### OpenAI Conversation API Patterns (for reference):

```
Conversations / chat threads
Each call to runner.run() (or run() utility) represents one turn in your application-level conversation. You choose how much of the RunResult you show the end‑user – sometimes only finalOutput, other times every generated item.

Example of carrying over the conversation history
import { Agent, run } from '@openai/agents';
import type { AgentInputItem } from '@openai/agents';

let thread: AgentInputItem[] = [];

const agent = new Agent({
  name: 'Assistant',
});

async function userSays(text: string) {
  const result = await run(
    agent,
    thread.concat({ role: 'user', content: text }),
  );

  thread = result.history; // Carry over history + newly generated items
  return result.finalOutput;
}

await userSays('What city is the Golden Gate Bridge in?');
// -> "San Francisco"

await userSays('What state is it in?');
// -> "California"

See the chat example for an interactive version.

Server-managed conversations
You can let the OpenAI Responses API persist conversation history for you instead of sending your entire local transcript on every turn. This is useful when you are coordinating long conversations or multiple services. See the Conversation state guide for details.

OpenAI exposes two ways to reuse server-side state:

1. conversationId for an entire conversation
You can create a conversation once using Conversations API and then reuse its ID for every turn. The SDK automatically includes only the newly generated items.

Reusing a server conversation
import { Agent, run } from '@openai/agents';
import { OpenAI } from 'openai';

const agent = new Agent({
  name: 'Assistant',
  instructions: 'Reply very concisely.',
});

async function main() {
  // Create a server-managed conversation:
  const client = new OpenAI();
  const { id: conversationId } = await client.conversations.create({});

  const first = await run(agent, 'What city is the Golden Gate Bridge in?', {
    conversationId,
  });
  console.log(first.finalOutput);
  // -> "San Francisco"

  const second = await run(agent, 'What state is it in?', { conversationId });
  console.log(second.finalOutput);
  // -> "California"
}

main().catch(console.error);

2. previousResponseId to continue from the last turn
If you want to start only with Responses API anyway, you can chain each request using the ID returned from the previous response. This keeps the context alive across turns without creating a full conversation resource.

Chaining with previousResponseId
import { Agent, run } from '@openai/agents';

const agent = new Agent({
  name: 'Assistant',
  instructions: 'Reply very concisely.',
});

async function main() {
  const first = await run(agent, 'What city is the Golden Gate Bridge in?');
  console.log(first.finalOutput);
  // -> "San Francisco"

  const previousResponseId = first.lastResponseId;
  const second = await run(agent, 'What state is it in?', {
    previousResponseId,
  });
  console.log(second.finalOutput);
  // -> "California"
}

main().catch(console.error);
```



#### Step 0.6: Add Structured Output ✅
- [x] Define output schemas per agent (Zod → JSON Schema)
- [x] Configure `outputType` for structured agents
- [x] Add `outputSchema` field to AgentConfig type
- [x] Update `runAgent` to pass outputType to Agent constructor
- [x] Add example agent with structured output (calendar-extractor)
- [x] Update widget to render structured responses
  - Created `structured-output.ts` parser with JSON detection
  - Updated Message component to extract `response` field
  - Added `suggestions` field for clickable quick-reply buttons
  - Clicking a suggestion sends it as a new user message
  - Implemented smart buffering: detects `{` at start, buffers entire JSON response
  - Plain text streams normally, structured JSON waits until complete (better UX)
  - Added 17 unit tests for parsing logic ✓
- [x] Schema validation on response (handled by OpenAI API)

### Architecture Changes

**Before:**
```
Widget → Hono API → AI SDK streamText → OpenRouter → LLM
```

**After:**
```
Widget → Hono API → Agents SDK Runner → OpenAI API → LLM
                  ↓
            Agent Handoffs
            Structured Output
            Voice (future)
```

### Model Configuration

**Default models (post-migration):**
- `gpt-4.1` - Default model (balanced)
- `gpt-4.1-mini` - Fast/cheap option

### Breaking Changes

1. **Model selection**: Limited to OpenAI models (gpt-4.1, gpt-4.1-mini, o1, etc.)
2. **Environment variable**: `OPENROUTER_API_KEY` → `OPENAI_API_KEY`
3. **Tool format**: Slightly different schema format
4. **Streaming events**: May have different event structure

### Scope for Phase 0

**Completed:**
- ✅ Core SDK migration (Steps 0.1-0.4)
- ✅ Structured Output (Step 0.6)
- Environment setup with `nodejs_compat`
- Tool migration to Agents SDK format
- Agent execution with `run()` function
- Streaming with `toTextStream()`
- Output schemas with Zod + `outputType`

**Remaining:**
- Handoffs (Step 0.5) - Optional
- Widget rendering for structured responses - Optional

**Deferred to Phase 6:**
- Human-in-the-Loop
- Voice Agents

### Rollback Plan

Keep the current AI SDK implementation in a separate branch. If migration fails or OpenAI-only models become a blocker, can revert.

### Cloudflare Workers Compatibility

Requires `nodejs_compat` flag in `wrangler.toml`:

```toml
compatibility_flags = [ "nodejs_compat" ]
compatibility_date = "2024-09-23"
```

This enables Node.js API support needed by the Agents SDK (Buffer, Crypto, Streams, etc.).

### Open Questions

- [x] Cloudflare Worker compatibility with Agents SDK? → **Use `nodejs_compat` flag**
- [x] HITL and Voice? → **Deferred to Phase 6**
- [ ] Can we keep OpenRouter as fallback for non-OpenAI models?
- [ ] Tracing: Agents SDK tracing vs Langfuse?

---

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
  - Include `type: 'chat' | 'voice'` field for future voice agent support
  - Voice agents share tools/prompts but have additional config (voice, audio format, etc.)
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

### Current: Mock Tenant Mode (Dev Only)
For development, we use a hardcoded mock tenant context:
- `TenantProvider` wraps the app with a dev tenant (ID: `dev-tenant-001`)
- `useTenant()` hook provides tenant info to components
- No login required - dashboard works immediately
- Dev mode banner shown on dashboard pages

### Future: Dashboard Auth Options

**Option A: API-Key Login (Simpler)**
- Tenant's API key serves as login credential
- Store key in localStorage, send with Worker requests
- Worker validates key → resolves to tenantId
- Single secret for both widget and dashboard access
- No user accounts, just tenant-level admin access

**Option B: Convex Auth (Full User Auth)**
- Real user accounts with email/OAuth
- Multiple users per tenant with roles (owner, editor, viewer)
- `users` + `tenantMembers` tables in Convex
- Better for enterprise/team features
- More setup work

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

### Human-in-the-Loop (Deferred from Phase 0)
- Implement approval workflow for sensitive tools
- Add `pending_approval` state to messages
- Create approval/rejection API endpoints
- Update widget with approval UI
- Configurable timeout and auto-reject behavior

### Voice Agents (Deferred from Phase 0)

**Goal**: Support real-time voice conversations alongside text chat, using the same tools and prompts.

**Architecture Principle**: Voice agents are **separate configs** but **share the core layer**:
- ✅ Same `getTools(agentId)` — tools work for both `Agent` and `RealtimeAgent`
- ✅ Same `resolveSystemPrompt()` — instructions work for both
- ✅ Same `AgentConfig` base — just extend with voice-specific fields
- 🆕 New `RealtimeAgent` + `RealtimeSession` from `@openai/agents/realtime`

**SDK Classes**:
| Chat Agent | Voice Agent |
|------------|-------------|
| `Agent` | `RealtimeAgent` |
| `run()` / `Runner` | `RealtimeSession` |
| HTTP/SSE | WebSocket/WebRTC |
| `gpt-4.1-mini`, etc. | `gpt-4o-realtime-preview` |

**VoiceAgentConfig Extension**:
```typescript
interface VoiceAgentConfig extends AgentConfig {
  type: 'voice';
  voice?: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse';
  realtimeModel?: 'gpt-4o-realtime-preview' | 'gpt-4o-mini-realtime-preview';
  inputAudioFormat?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
  outputAudioFormat?: 'pcm16' | 'g711_ulaw' | 'g711_alaw';
  turnDetection?: {
    type: 'server_vad' | 'semantic_vad';
    threshold?: number;
    silenceDuration?: number;
    interruptResponse?: boolean;
  };
  inputTranscription?: { model: 'gpt-4o-mini-transcribe' | 'gpt-4o-transcribe' };
}
```

**Cloudflare Workers Compatibility**:
Workers can't use native WebSocket constructor. Must use:
```typescript
import { CloudflareRealtimeTransportLayer } from '@openai/agents-extensions';

const transport = new CloudflareRealtimeTransportLayer({
  url: 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
});
const session = new RealtimeSession(agent, { transport });
```

**Implementation Routes**:

1. **Browser WebRTC** (simplest for web voice):
   - Client-side `RealtimeSession` with `OpenAIRealtimeWebRTC`
   - Worker provides session token/ephemeral key + agent config
   - Lowest latency, OpenAI handles media

2. **Twilio Phone** (via Worker):
   - Twilio → WebSocket → Worker → OpenAI Realtime API
   - Use `CloudflareRealtimeTransportLayer` in Worker
   - May need Durable Objects for persistent WebSocket state
   - Worker bridges audio between Twilio Media Streams and OpenAI

**Implementation Steps**:
- [ ] Add `type?: 'chat' | 'voice'` field to AgentConfig (do in Phase 2 schema)
- [ ] Install `@openai/agents-extensions` for Cloudflare transport
- [ ] Create `worker/src/agents/voice.ts` with `createVoiceAgent()`
- [ ] Add `/api/voice/session` endpoint for browser WebRTC token
- [ ] Add `/api/voice/twilio` webhook for incoming calls
- [ ] Add `/api/voice/stream` WebSocket for Twilio Media Streams
- [ ] Test browser voice with client-side SDK
- [ ] Implement Twilio integration (may need Durable Objects)

**File Structure**:
```
worker/src/
├── agents/
│   ├── index.ts      # Chat agent runner (existing)
│   ├── voice.ts      # Voice agent runner (new)
│   └── prompts.ts    # Shared prompt resolution
├── routes/
│   ├── chat.ts       # POST /api/chats/:id/messages
│   └── voice.ts      # WebSocket /api/voice/*, Twilio webhooks
└── realtime/
    └── session.ts    # RealtimeSession management
```

**Timing**: Can be implemented anytime after Phase 2 (Database). The shared layer (tools, prompts) is already compatible. Only dependency is having `type` field in DB schema to distinguish agent types.

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
              │                    │                    │
              ▼                    ▼                    ▼
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────────┐
│   Chat Widget     │  │  Browser Voice    │  │    Twilio Phone       │
│  (React + SSE)    │  │    (WebRTC)       │  │   (SIP/WebSocket)     │
└─────────┬─────────┘  └─────────┬─────────┘  └───────────┬───────────┘
          │                      │                        │
          │ API Key Auth         │ Ephemeral Token        │ Webhook
          ▼                      ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Cloudflare Worker API                             │
│                    (Hono + OpenAI Agents SDK)                        │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                      SHARED LAYER                                ││
│  │  • getTools(agentId)        — same tools for chat & voice       ││
│  │  • resolveSystemPrompt()    — same instructions                 ││
│  │  • getAgentConfig()         — unified config lookup             ││
│  └─────────────────────────────────────────────────────────────────┘│
│            │                              │                          │
│            ▼                              ▼                          │
│  ┌─────────────────────┐      ┌─────────────────────────────────┐  │
│  │   Agent (text)      │      │   RealtimeAgent (voice)         │  │
│  │   run() → SSE       │      │   RealtimeSession → WebSocket   │  │
│  └─────────────────────┘      └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐    ┌────────────────────────────────────┐
│         Convex            │    │           External Services         │
│                           │    │  ┌──────────┐  ┌─────────────────┐ │
│  • Tenant configs         │    │  │ OpenAI   │  │  Langfuse       │ │
│  • Chat history           │    │  │   API    │  │  (Tracing/Eval) │ │
│  • API keys               │    │  │ Realtime │  └─────────────────┘ │
│  • Documents (files)      │    │  └──────────┘  ┌─────────────────┐ │
│  • Vector embeddings      │    │  ┌──────────┐  │  Webhooks       │ │
│                           │    │  │MCP Server│  │  (Custom Tools) │ │
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

0. **Phase 0**: OpenAI Agents SDK migration (handoffs, structured output, voice prep)
1. **Phase 1**: Dashboard web app with Clerk auth
2. **Phase 2**: Database integration with Convex
3. **Phase 3**: Worker auth with API keys
4. **Phase 4**: Eval runner with Langfuse
5. **Phase 5**: RAG knowledgebase (document upload + vector search)
6. **Phase 6**: Advanced features as needed


#### Deferred: Add Handoffs Support
- [ ] Define handoff targets in agent config
- [ ] Implement `handoff()` function for agent transfers
- [ ] Add handoff routing logic
- [ ] Store handoff context in chat history
- [ ] Update widget to handle handoff events

---

## Open Questions

- [x] Which database? → **Hybrid: Convex (configs/RAG) + D1 (conversations)**
- [x] Which AI SDK? → **OpenAI Agents SDK (for handoffs, structured output, voice)**
- [x] OpenAI Agents SDK: Python vs TypeScript? → **TypeScript (`@openai/agents-sdk`)**
- [x] Cloudflare Worker compatibility? → **Use `nodejs_compat` flag + compatibility_date ≥ 2024-09-23**
- [x] Voice agents architecture? → **Separate configs, shared tools/prompts. Use `RealtimeAgent` + `CloudflareRealtimeTransportLayer`. Twilio via WebSocket, browser via WebRTC. See Phase 6.**
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

