# TanStack AI SDK Migration Spec

Migrate from OpenAI Agents SDK (`@openai/agents`) to TanStack AI SDK (`@tanstack/ai`) with OpenRouter for model flexibility.

Update this doc with any progress as you go.

## Overview

**Current:** OpenAI Agents SDK with `Agent` class, `run()` streaming, `previousResponseId` continuity  
**Target:** TanStack AI with `chat()`, `toolDefinition()`, OpenRouter adapter, `toServerSentEventsResponse()`

**Benefits:**
- Provider-agnostic: Claude, GPT, Gemini, Llama via OpenRouter
- Better type safety with full TypeScript inference
- Built-in agent loop strategies (`maxIterations`, `untilFinishReason`)
- Isomorphic tools: Define once, implement for server/client

---

## Phases

### Phase 0: Dependency & Config Prep (no behavior change) ✅

**Status:** COMPLETE

**Goal:** Install TanStack AI + OpenRouter adapter, but don't use it yet.

**Files:**
- `worker/package.json` - Add deps
- `worker/src/ai/openrouter.ts` - New file

**Steps:**

1. Add TanStack deps:
```bash
cd worker
npm install @tanstack/ai @tanstack/ai-openai
```

2. Create OpenRouter adapter:
```typescript
// worker/src/ai/openrouter.ts
import { createOpenAIChat } from '@tanstack/ai-openai';

export function createOpenRouterChat(apiKey: string) {
  return createOpenAIChat({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });
}
```

**Acceptance:** No behavior change. Existing tests pass.

**Notes:**
- TanStack AI requires Zod 4 (upgraded from `^3.25.40` to `^4.0.0`)
- Full project `tsc --noEmit` runs OOM due to Zod 4's complex type inference - this is a [known issue](https://github.com/colinhacks/zod/issues/4036). `skipLibCheck: true` is already enabled. Tests run fine. Consider breaking up type checking per-directory if this becomes blocking.

---

### Phase 1: TanStack Runtime Skeleton (no routing changes) ✅

**Status:** COMPLETE (implemented alongside Phase 2)

**Goal:** Build `runAgentTanStack()` that mirrors current `runAgent()`, but don't wire it to routes yet.

**Files:**
- `worker/src/agents/tanstack.ts` - New file
- `worker/src/agents/index.ts` - Export new runner

**Steps:**

1. Create TanStack runner (tools disabled initially):
```typescript
// worker/src/agents/tanstack.ts
import { chat, maxIterations } from '@tanstack/ai';
import { createOpenRouterChat } from '../ai/openrouter';
import { getAgentConfig } from '../tenants/config';
import { resolveSystemPrompt } from './prompts';
import type { RunAgentOptions } from './index';

export async function runAgentTanStack(options: RunAgentOptions) {
  const { messages, apiKey, agentId, model: requestedModel, systemPrompt, env = {} } = options;
  
  const agentConfig = await getAgentConfig(agentId, { CONVEX_URL: env.CONVEX_URL });
  const model = requestedModel || agentConfig.model || 'gpt-4.1-mini';
  const instructions = await resolveSystemPrompt(agentConfig, agentId, systemPrompt, env);
  
  const openrouter = createOpenRouterChat(apiKey);
  const adapter = openrouter({ model });
  
  const tanstackMessages = messages.map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: [{ type: 'text' as const, text: m.content }],
  }));
  
  return chat({
    adapter,
    messages: tanstackMessages,
    tools: [], // Wired in Phase 2
    system: instructions,
    agentLoopStrategy: maxIterations(8),
  });
}
```

2. Export from index (don't use yet):
```typescript
// worker/src/agents/index.ts (add at bottom)
export { runAgentTanStack } from './tanstack';
```

**Acceptance:** Existing tests pass. New runner exists but unused.

---

### Phase 2: Tool Migration to `toolDefinition()` ✅

**Status:** COMPLETE

**Goal:** Migrate tools to TanStack format while maintaining Agents SDK compatibility.

**Files:**
- `worker/src/tools/vectorSearch.ts` - Add TanStack tool
- `worker/src/tools/index.ts` - Add `getAiTools()` function
- `worker/src/agents/tanstack.ts` - Wire tools

**Steps:**

1. Add TanStack tool definition alongside existing:
```typescript
// worker/src/tools/vectorSearch.ts
import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';

export const searchKnowledgeDef = toolDefinition({
  name: 'search_knowledge',
  description: 'Search the knowledge base for relevant information',
  inputSchema: z.object({
    query: z.string().describe('Search query'),
    limit: z.number().int().positive().optional().default(5),
  }),
  outputSchema: z.object({
    results: z.array(z.object({ text: z.string(), score: z.number() })),
  }),
});

export const searchKnowledgeTool = searchKnowledgeDef.server(async (input, ctx) => {
  // Reuse existing Convex RAG logic
  // ...
});
```

2. Add `getAiTools()` for TanStack path:
```typescript
// worker/src/tools/index.ts
export async function getAiTools(agentId: string, env?: AgentConfigEnv, options?: GetToolsOptions) {
  const config = await getAgentConfig(agentId, env);
  const tools = [];
  
  if (config?.agentConvexId && options?.convexUrl) {
    tools.push(searchKnowledgeTool);
  }
  
  return tools;
}
```

3. Wire tools in TanStack runner.

**Acceptance:** Both `getTools()` (Agents) and `getAiTools()` (TanStack) return functional tools.

**Notes:**
- `createKnowledgeBaseSearchToolTanStack()` created as factory function (mirrors existing pattern)
- MCP tools not yet migrated to TanStack path (TODO noted in code)

---

### Phase 3: SSE Endpoint with Feature Flag

**Goal:** Add opt-in TanStack/OpenRouter path via `?engine=tanstack` query param.

**Files:**
- `worker/src/agents/tanstack.ts` - Add SSE helper
- `worker/src/index.ts` - Add engine switch

**Steps:**

1. Add SSE response helper:
```typescript
// worker/src/agents/tanstack.ts
import { toServerSentEventsResponse } from '@tanstack/ai';

export async function runAgentTanStackSSE(options: RunAgentOptions & { chatId: string }) {
  const stream = await runAgentTanStack(options);
  // TODO: Subscribe to events for message persistence
  return toServerSentEventsResponse(stream);
}
```

2. Add engine switch in route:
```typescript
// worker/src/index.ts (in POST /api/chats/:chatId/messages)
const engine = c.req.query('engine') || 'agents'; // 'agents' | 'tanstack'
const useTanStack = engine === 'tanstack';

if (useTanStack) {
  return runAgentTanStackSSE({ ...options, chatId });
}
// Existing Agents SDK path unchanged
```

**Acceptance:** 
- `POST /api/chats/:id/messages` works as before (default)
- `POST /api/chats/:id/messages?engine=tanstack` uses TanStack/OpenRouter

---

### Phase 4: Flip Default & Cleanup

**Goal:** Make TanStack the default, remove Agents SDK.

**Files:**
- `worker/package.json` - Remove `@openai/agents`, `@openai/agents-extensions`
- `worker/src/agents/index.ts` - Remove old `runAgent()`
- `worker/src/tools/index.ts` - Remove `getTools()`, keep only `getAiTools()`
- `worker/src/index.ts` - Remove Agents path, update `/api/models`

**Steps:**

1. Change default: `const engine = c.req.query('engine') || 'tanstack';`
2. Remove Agents SDK code and deps
3. Remove `previousResponseId` logic from storage
4. Update `/api/models` with OpenRouter model IDs:
```typescript
const models = [
  { name: 'gpt-4.1-mini', id: 'openai/gpt-4.1-mini', description: 'Fast and affordable' },
  { name: 'claude-sonnet-4', id: 'anthropic/claude-sonnet-4', description: 'Anthropic Claude' },
  { name: 'gemini-2.0-flash', id: 'google/gemini-2.0-flash', description: 'Google Gemini' },
];
```

**Acceptance:** All tests pass with TanStack only. Agents SDK removed.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Tool behavior differences | Start with 1-2 tools in TanStack path, add gradually |
| SSE format changes | Keep `engine=agents` path for existing clients during transition |
| No `previousResponseId` | Cap history length, add summarization later if needed |
| Model ID mismatch | Maintain clear mapping in one place, validate with `isValidModel()` |

---

## References

- [TanStack AI Docs](https://tanstack.com/ai/latest/docs/getting-started/overview)
- [OpenRouter API](https://openrouter.ai/docs)
- [PLAN.md](../PLAN.md) - Project architecture
