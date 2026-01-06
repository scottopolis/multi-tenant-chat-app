# Convex RAG Migration Plan

Replace OpenAI Vector Store + File Search with Convex RAG component for knowledge base functionality.

## Goals

- Remove dependency on OpenAI's vector store and file search APIs
- Use Convex RAG component with namespaces for multi-tenant isolation
- Store uploaded files in Convex file storage
- Unified search mechanism for both chat and voice agents
- Text files only initially (PDF/doc extraction deferred)

## Current Architecture

**OpenAI-based:**
- `worker/src/lib/vectorStore.ts` - CRUD operations against OpenAI Vector Store API
- `worker/src/tools/vectorSearch.ts` - Custom function tool that queries OpenAI's `/vector_stores/{id}/search` endpoint
- `worker/src/tools/index.ts` - Uses `fileSearchTool` (hosted) for chat, `createVectorSearchTool` (function) for voice
- `worker/src/routes/documents.ts` - Upload/delete/list endpoints, creates vector stores on-demand
- `convex-backend/convex/schema.ts` - Agents table has `vectorStoreId` field (OpenAI Vector Store ID)

## Target Architecture

**Convex RAG-based:**
- Convex RAG component installed in `convex-backend`
- Namespaces: one per agent (e.g., `agent:{agentId}`)
- Files stored in Convex file storage with metadata in a new `documents` table
- Single search tool (function-based) that calls a Convex action from the Worker
- Remove `vectorStoreId` from agents table (no longer needed)

## Implementation Phases

### Phase 1: Set Up Convex RAG Component

**convex-backend changes:**

1. Install dependencies:
   - `@convex-dev/rag`
   - `@ai-sdk/openai` (for embeddings)

2. Create `convex/convex.config.ts`:
   ```ts
   import { defineApp } from "convex/server";
   import rag from "@convex-dev/rag/convex.config";
   const app = defineApp();
   app.use(rag);
   export default app;
   ```

3. Create `convex/rag.ts` - RAG instance configuration:
   - Use `text-embedding-3-small` (1536 dimensions)
   - No custom filters needed initially

4. Add `documents` table to schema:
   - `tenantId`, `agentId`, `fileName`, `fileSize`, `storageId` (Convex file ref), `status`, `createdAt`
   - Index by `agentId` for listing

### Phase 2: Convex Actions for RAG Operations

**New Convex actions in `convex/rag.ts`:**

1. `addDocument` - Upload file to Convex storage, extract text, add to RAG with namespace
2. `deleteDocument` - Remove from RAG, delete from file storage
3. `listDocuments` - Query documents table by agentId
4. `searchKnowledgeBase` - Call `rag.search()` with agent's namespace

**Text extraction:**
- For `.txt` and `.md` files: read directly
- Defer other formats (return error for unsupported types)

### Phase 3: Update Worker to Use Convex RAG

**worker changes:**

1. Delete `worker/src/lib/vectorStore.ts` (no longer needed)

2. Update `worker/src/routes/documents.ts`:
   - Upload: Store file in Convex via HTTP action, call `addDocument` action
   - Delete: Call `deleteDocument` action
   - List: Call `listDocuments` action
   - Remove all OpenAI Vector Store API calls

3. Replace `worker/src/tools/vectorSearch.ts`:
   - New implementation calls Convex `searchKnowledgeBase` action
   - Same tool interface (`search_knowledge_base` with `query` param)

4. Update `worker/src/tools/index.ts`:
   - Remove `fileSearchTool` import and usage
   - Use the new Convex-based search tool for both chat and voice
   - Remove `forVoice` branching (unified approach)

### Phase 4: Schema & Cleanup

1. Remove `vectorStoreId` field from agents table in Convex schema
2. Update `convex/agents.ts` mutations to remove vectorStoreId handling
3. Delete `worker/src/tools/vectorSearch.ts` (old OpenAI version)
4. Update tests in `worker/src/routes/documents.test.ts`

## Files to Modify

| File | Action |
|------|--------|
| `convex-backend/package.json` | Add `@convex-dev/rag`, `@ai-sdk/openai` |
| `convex-backend/convex/convex.config.ts` | Create - RAG component setup |
| `convex-backend/convex/rag.ts` | Create - RAG instance + actions |
| `convex-backend/convex/schema.ts` | Add `documents` table, remove `vectorStoreId` from agents |
| `convex-backend/convex/agents.ts` | Remove vectorStoreId mutation logic |
| `worker/src/lib/vectorStore.ts` | Delete |
| `worker/src/routes/documents.ts` | Rewrite to call Convex actions |
| `worker/src/tools/vectorSearch.ts` | Rewrite to call Convex search action |
| `worker/src/tools/index.ts` | Simplify - unified search tool |
| `worker/src/routes/documents.test.ts` | Update for new implementation |

## API Contracts (No Change)

The external API surface remains the same:
- `POST /api/documents/upload` - multipart form with `file`
- `DELETE /api/documents/:fileId`
- `GET /api/documents`
- Tool: `search_knowledge_base({ query: string })`

## Open Questions / Future Work

1. **PDF/doc support**: Add server-side extraction later (consider Convex action with pdf-parse or similar)
2. **Chunking strategy**: Convex RAG auto-chunks, but may want custom chunking for large files
3. **Embedding model**: Starting with `text-embedding-3-small`, could make configurable per-tenant
4. **File size limits**: Currently 10MB, may need to adjust for Convex action limits

## Rollout

1. Implement in feature branch
2. Test with new agents (no migration needed)
3. Deploy - existing agents without documents work immediately
4. Agents with existing OpenAI vector stores: documents won't appear (acceptable - no migration)
