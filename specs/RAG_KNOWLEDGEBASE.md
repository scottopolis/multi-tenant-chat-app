# RAG Knowledgebase Feature Spec

## Overview

Allow tenants to upload documents to a knowledge base. OpenAI File Search handles parsing, chunking, embedding, and retrieval automatically. The agent uses the built-in `file_search` tool to query the knowledge base.

---

## Approach: OpenAI File Search

We use OpenAI's managed File Search instead of building custom RAG infrastructure:

| What | How |
|------|-----|
| File parsing | OpenAI (automatic) |
| Chunking | OpenAI (automatic) |
| Embeddings | OpenAI (automatic) |
| Vector storage | OpenAI Vector Stores |
| Retrieval | Built-in `file_search` tool |

**Benefits**: ~90% less code, no PDF parsing libraries, no embedding logic, battle-tested retrieval.

**Costs**: ~$0.10/GB/day storage (first 1GB free) + retrieved chunks count as input tokens.

---

## Requirements

### Supported File Types
- PDF (.pdf)
- Plain text (.txt)
- Markdown (.md)
- CSV (.csv)

OpenAI also supports: .docx, .html, .json, and more.

### Storage Limits
- Max file size: 10 MB per file (OpenAI limit: 512 MB)
- Max total storage per tenant: 100 MB

---

## Architecture

```
Dashboard                    Convex                         Worker
─────────────────────────────────────────────────────────────────────
Upload file      →    Call worker to upload
                                                    Upload to OpenAI Vector Store
                                                    Return file ID
                      Store metadata (fileId, name, size)
                      ← List/delete documents

                                                    Agent with file_search tool
                                                    attached to tenant's vector store
                                                              ↓
                                                    OpenAI retrieves relevant chunks
                                                              ↓
                                                    Agent responds with context
```

---

## Data Model

### `agents` table (existing - add field)
| Field | Type | Description |
|-------|------|-------------|
| ... | ... | Existing fields |
| vectorStoreId | string? | OpenAI Vector Store ID for this agent |

**Simplified Approach:**
- ✅ No `documents` table - query OpenAI directly via `listVectorStoreFiles()`
- ✅ No `embeddings` table - OpenAI manages chunks internally
- ✅ 30-second in-memory cache to reduce API calls
- ✅ Single source of truth (OpenAI Vector Stores)
- ✅ Cache invalidation on upload/delete operations

---

## Implementation Tasks

Each task is ~15 minutes. Complete verification before proceeding to next task.

---

### Phase 1: OpenAI Vector Store Setup

#### Task 1: Create Vector Store management utilities
Add functions to create/delete OpenAI Vector Stores.

**Files:** `worker/src/lib/vectorStore.ts`

**Code:**
```typescript
import OpenAI from 'openai';

const openai = new OpenAI();

export async function createVectorStore(name: string): Promise<string> {
  const store = await openai.vectorStores.create({ name });
  return store.id;
}

export async function deleteVectorStore(id: string): Promise<void> {
  await openai.vectorStores.del(id);
}
```

**Verify:**
- [ ] Can create a vector store via OpenAI API
- [ ] Vector store appears in OpenAI dashboard

---

#### Task 2: Create file upload to Vector Store
Add function to upload files to an OpenAI Vector Store.

**Files:** `worker/src/lib/vectorStore.ts`

**Code:**
```typescript
export async function uploadFileToVectorStore(
  vectorStoreId: string,
  file: File,
  filename: string
): Promise<string> {
  // Upload file to OpenAI
  const uploadedFile = await openai.files.create({
    file,
    purpose: 'assistants',
  });

  // Attach to vector store
  await openai.vectorStores.files.create(vectorStoreId, {
    file_id: uploadedFile.id,
  });

  return uploadedFile.id;
}

export async function deleteFileFromVectorStore(
  vectorStoreId: string,
  fileId: string
): Promise<void> {
  await openai.vectorStores.files.del(vectorStoreId, fileId);
  await openai.files.del(fileId);
}
```

**Verify:**
- [ ] Can upload a .txt file to vector store
- [ ] File appears in OpenAI Vector Store
- [ ] Can delete file from vector store

---

### Phase 2: Convex Schema Update

#### Task 3: Update Convex schema ✅ COMPLETED
Add `vectorStoreId` to agents table. Add caching to vector store utilities.

**Files:**
- `convex-backend/convex/schema.ts`
- `worker/src/lib/vectorStore.ts`

**Changes:**
- Added `vectorStoreId: v.optional(v.string())` to agents table
- Removed `documents` and `embeddings` tables (not needed)
- Added `listVectorStoreFiles()` with 30-second cache
- Cache invalidation on upload/delete operations

**Verify:**
- [x] Schema updated with vectorStoreId field
- [x] Caching implemented and tested
- [x] Cache invalidates on mutations

---

#### Task 4: ~~Create document CRUD operations~~ (NOT NEEDED)
We query OpenAI directly instead of storing metadata in Convex.

---

### Phase 3: Worker API Endpoints

#### Task 5: Create upload endpoint ✅ COMPLETED
API endpoint to handle file upload from dashboard.

**Files:** `worker/src/routes/documents.ts`, `worker/src/routes/documents.test.ts`

**Endpoint:** `POST /api/documents/upload`

**Flow:**
1. Receive file from dashboard
2. Get agent from Convex (check vectorStoreId)
3. Create vector store if needed, update agent
4. Upload file to OpenAI Vector Store
5. Return success (cache auto-invalidates)

**Verify:**
- [x] Can upload file via API endpoint
- [x] File appears in OpenAI Vector Store (via `listVectorStoreFiles()`)
- [x] vectorStoreId stored in agent record
- [x] File size validation (10MB limit)

---

#### Task 6: Create delete endpoint ✅ COMPLETED
API endpoint to delete a document.

**Files:** `worker/src/routes/documents.ts`, `worker/src/routes/documents.test.ts`

**Endpoint:** `DELETE /api/documents/:fileId`

**Flow:**
1. Get agent from Convex (get vectorStoreId)
2. Delete file from OpenAI Vector Store via `deleteFileFromVectorStore()`
3. Return success (cache auto-invalidates)

**Verify:**
- [x] Can delete file via API endpoint
- [x] File removed from OpenAI Vector Store
- [x] Cache invalidated, file no longer in list

**Also added:** `GET /api/documents` endpoint to list files

---

### Phase 4: Dashboard UI

#### Task 7: Create KnowledgeBase component
Basic component with upload zone and document list.

**Files:** `dashboard/app/components/KnowledgeBase.tsx`

**Verify:**
- [ ] Component renders in agent edit page
- [ ] Shows upload dropzone with accepted file types
- [ ] Shows "No documents" empty state

---

#### Task 8: Wire up file upload
Connect upload UI to worker API.

**Files:** `dashboard/app/components/KnowledgeBase.tsx`

**Verify:**
- [ ] Select file → uploads via API
- [ ] Shows uploading state
- [ ] Document appears in list when ready

---

#### Task 9: Add delete functionality
Add delete button to document list.

**Files:** `dashboard/app/components/KnowledgeBase.tsx`

**Verify:**
- [ ] Delete button calls API
- [ ] Document removed from list
- [ ] Confirmation before delete

---

### Phase 5: Agent Integration

#### Task 10: Enable file_search tool on agent
Attach vector store to agent and enable file_search.

**Files:** `worker/src/agent.ts`

**Code:**
```typescript
const agent = new Agent({
  // ... existing config
  tools: [
    { type: 'file_search' },
    // ... other tools
  ],
  tool_resources: {
    file_search: {
      vector_store_ids: [tenant.vectorStoreId],
    },
  },
});
```

**Verify:**
- [ ] Agent has file_search tool enabled
- [ ] Agent can retrieve from uploaded documents
- [ ] Response includes relevant context from docs

---

#### Task 11: End-to-end test
Full flow test from upload to retrieval.

**Test Steps:**
1. Upload a document with known content
2. Ask agent a question about that content
3. Verify agent uses file_search and returns correct info

**Verify:**
- [ ] Upload → agent can answer questions about document
- [ ] Agent cites source in response
- [ ] Delete document → agent no longer has access

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1. Vector Store Setup | 1-2 ✅ | OpenAI Vector Store utilities |
| 2. Convex Schema | 3 ✅ | Add vectorStoreId + caching |
| 3. Worker API | 5-6 ✅ | Upload/delete/list endpoints |
| 4. Dashboard UI | 7-9 | Upload and list components |
| 5. Agent Integration | 10-11 | Enable file_search tool |

**Completed: 5 tasks** | **Remaining: 5 tasks (UI + Agent integration)**

---

## API Endpoints

### Worker Routes
- `POST /api/documents/upload` - Upload file to vector store
- `DELETE /api/documents/:fileId` - Delete file from vector store
- `GET /api/documents/:agentId` - List documents for agent (uses cached `listVectorStoreFiles()`)

### Vector Store Utilities (worker/src/lib/vectorStore.ts)
- `createVectorStore(name)` - Create new OpenAI Vector Store
- `deleteVectorStore(id)` - Delete Vector Store
- `uploadFileToVectorStore(storeId, file, filename)` - Upload file and attach to store
- `deleteFileFromVectorStore(storeId, fileId)` - Delete file from store
- `listVectorStoreFiles(storeId, options?)` - List files with caching

---

## UI Components

### KnowledgeBase.tsx (Dashboard)
```
┌─────────────────────────────────────────────────┐
│ Knowledge Base                                  │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │  Drop files here or click to upload         │ │
│ │     PDF, TXT, MD, CSV (max 10MB)            │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Documents (3 files)                             │
│ ┌─────────────────────────────────────────────┐ │
│ │ product-guide.pdf       2.3 MB   Ready    X │ │
│ │ faq.md                  45 KB    Ready    X │ │
│ │ pricing.csv             12 KB    Ready    X │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## OpenAI File Search Details

### How It Works
1. Files uploaded to Vector Store are automatically parsed
2. Content is chunked (OpenAI uses smart chunking)
3. Chunks are embedded and indexed
4. When agent uses `file_search`, OpenAI:
   - Embeds the query
   - Finds relevant chunks via vector similarity
   - Returns chunks as context to the model

### Supported File Types (OpenAI)
.pdf, .md, .txt, .csv, .docx, .html, .json, .pptx, .tex, .c, .cpp, .java, .js, .py, .rb, .ts, and more.

### Pricing
- Storage: $0.10/GB/day (first 1GB free)
- Retrieval: Chunks returned count as input tokens

---

## Open Questions (Resolved)

- ~~Embedding model?~~ → OpenAI (automatic)
- ~~Vector DB?~~ → OpenAI Vector Stores
- ~~File storage?~~ → OpenAI Files API
- ~~Chunking strategy?~~ → OpenAI (automatic)
- ~~Custom RAG vs managed?~~ → Managed (OpenAI File Search)

---

## Future Enhancements (Out of Scope)
- Web page URL ingestion
- Folder organization
- Custom chunking strategies
- Usage analytics per document
- Migrate to AWS Bedrock (cost optimization)

---

*Created: December 2024*
*Updated: December 2024 - Switched to OpenAI File Search*
