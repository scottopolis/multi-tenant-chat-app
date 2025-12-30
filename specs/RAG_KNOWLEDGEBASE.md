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

### `documents` table (Convex - metadata only)
| Field | Type | Description |
|-------|------|-------------|
| tenantId | string | Tenant reference |
| openaiFileId | string | OpenAI file ID |
| fileName | string | Original file name |
| fileType | string | pdf, txt, md, csv |
| fileSize | number | Size in bytes |
| status | string | uploading, ready, error |
| createdAt | number | Upload timestamp |
| errorMessage | string? | Error details if failed |

### `agents` table (existing - add field)
| Field | Type | Description |
|-------|------|-------------|
| ... | ... | Existing fields |
| vectorStoreId | string? | OpenAI Vector Store ID for this agent |

**Note**: No `documentChunks` table needed - OpenAI manages chunks internally.

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

### Phase 2: Convex Data Layer

#### Task 3: Update Convex schema
Add `documents` table and `vectorStoreId` to agents.

**Files:** `convex/schema.ts`

**Verify:**
- [ ] `npx convex dev` runs without schema errors
- [ ] Tables visible in Convex dashboard

---

#### Task 4: Create document CRUD operations
Add mutations/queries for document metadata.

**Files:** `convex/documents.ts`

**Functions:**
- `documents.create` - Store document metadata after upload
- `documents.list` - List documents for a tenant/agent
- `documents.delete` - Remove document metadata

**Verify:**
- [ ] Can create document record
- [ ] Can list documents filtered by tenantId
- [ ] Can delete document record

---

### Phase 3: Worker API Endpoints

#### Task 5: Create upload endpoint
API endpoint to handle file upload from dashboard.

**Files:** `worker/src/routes/documents.ts`

**Endpoint:** `POST /api/documents/upload`

**Flow:**
1. Receive file from dashboard
2. Get or create vector store for tenant
3. Upload file to OpenAI
4. Store metadata in Convex
5. Return success

**Verify:**
- [ ] Can upload file via API endpoint
- [ ] File appears in OpenAI Vector Store
- [ ] Metadata stored in Convex

---

#### Task 6: Create delete endpoint
API endpoint to delete a document.

**Files:** `worker/src/routes/documents.ts`

**Endpoint:** `DELETE /api/documents/:id`

**Flow:**
1. Get document metadata from Convex
2. Delete file from OpenAI Vector Store
3. Delete metadata from Convex

**Verify:**
- [ ] Can delete file via API endpoint
- [ ] File removed from OpenAI
- [ ] Metadata removed from Convex

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
| 1. Vector Store Setup | 1-2 | OpenAI Vector Store utilities |
| 2. Convex Data Layer | 3-4 | Document metadata storage |
| 3. Worker API | 5-6 | Upload/delete endpoints |
| 4. Dashboard UI | 7-9 | Upload and list components |
| 5. Agent Integration | 10-11 | Enable file_search tool |

**Total: 11 tasks × ~15 min = ~3 hours**

---

## API Endpoints

### Worker Routes
- `POST /api/documents/upload` - Upload file to knowledge base
- `DELETE /api/documents/:id` - Delete document
- `GET /api/documents` - List documents (optional, can use Convex directly)

### Convex Functions
- `documents.create` - Store document metadata
- `documents.list` - List tenant documents
- `documents.delete` - Delete document metadata

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
