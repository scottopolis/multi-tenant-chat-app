# Convex RAG Migration Plan

Replace OpenAI Vector Store + File Search with Convex RAG component for knowledge base functionality.

## Status: Phases 1-3 Complete ✅

## Goals

- ✅ Remove dependency on OpenAI's vector store and file search APIs
- ✅ Use Convex RAG component with namespaces for multi-tenant isolation
- ✅ Store uploaded files in Convex file storage
- ✅ Unified search mechanism for both chat and voice agents
- ✅ Text files only initially (PDF/doc extraction deferred)

## Architecture

**Convex RAG-based:**
- `@convex-dev/rag` component with `@ai-sdk/openai@2` for embeddings
- Namespaces: one per agent (e.g., `agent:{agentId}`)
- Files stored in Convex file storage with metadata in `documents` table
- Single `search_knowledge_base` tool that calls Convex `searchKnowledgeBase` action
- Uses `agentConvexId` (Convex document _id) instead of `vectorStoreId`

## Implementation Phases

### Phase 1: Set Up Convex RAG Component ✅

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

### Phase 2: Convex Actions for RAG Operations ✅

**Convex actions in `convex/documents.ts`:**

1. `addDocument` - Upload file to Convex storage, extract text, add to RAG with namespace
2. `deleteDocument` - Remove from RAG, delete from file storage
3. `listDocuments` - Query documents table by agentId
4. `searchKnowledgeBase` - Call `rag.search()` with agent's namespace

**Text extraction:**
- For `.txt` and `.md` files: read directly
- Defer other formats (return error for unsupported types)

### Phase 3: Update Worker to Use Convex RAG ✅

**worker changes:**

1. ✅ Deleted `worker/src/lib/vectorStore.ts`
2. ✅ Rewrote `worker/src/routes/documents.ts` to call Convex actions
3. ✅ Rewrote `worker/src/tools/vectorSearch.ts` to call Convex `searchKnowledgeBase`
4. ✅ Updated `worker/src/tools/index.ts` - unified search, removed `fileSearchTool`
5. ✅ Updated `worker/src/tenants/types.ts` - replaced `vectorStoreId` with `agentConvexId`
6. ✅ Updated `worker/src/tenants/config.ts` - fetch `agentConvexId` from `result._id`
7. ✅ Deleted old test files (`vectorStore.test.ts`, `documents.test.ts`)

### Phase 4: Schema & Cleanup (TODO)

1. Remove `vectorStoreId` field from agents table in Convex schema
2. Update `convex/agents.ts` mutations to remove vectorStoreId handling
3. Add new tests for Convex RAG integration

## Files Modified

| File | Status |
|------|--------|
| `convex-backend/package.json` | ✅ Added `@convex-dev/rag`, `@ai-sdk/openai@2` |
| `convex-backend/convex/convex.config.ts` | ✅ Created - RAG component setup |
| `convex-backend/convex/rag.ts` | ✅ Created - RAG instance config |
| `convex-backend/convex/documents.ts` | ✅ Created - RAG actions |
| `convex-backend/convex/schema.ts` | ✅ Added `documents` table |
| `worker/src/lib/vectorStore.ts` | ✅ Deleted |
| `worker/src/routes/documents.ts` | ✅ Rewritten to call Convex actions |
| `worker/src/tools/vectorSearch.ts` | ✅ Rewritten to call Convex search |
| `worker/src/tools/index.ts` | ✅ Unified search tool |
| `worker/src/tenants/types.ts` | ✅ `vectorStoreId` → `agentConvexId` |
| `worker/src/tenants/config.ts` | ✅ Fetch `agentConvexId` |
| `convex-backend/convex/agents.ts` | TODO: Remove vectorStoreId |
| `convex-backend/convex/schema.ts` | TODO: Remove vectorStoreId from agents |

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
