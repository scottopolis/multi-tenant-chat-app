# RAG Knowledgebase Feature Spec

## Overview

Allow tenants to upload documents that are embedded and stored in a vector database. The agent retrieves relevant chunks via tool call to augment responses with tenant-specific knowledge.

---

## Requirements

### Supported File Types
- PDF (.pdf)
- Plain text (.txt)
- Markdown (.md)
- CSV (.csv)

### Storage Limits
- Max file size: 10 MB per file
- Max total storage per tenant: 100 MB

### Embedding
- Model: OpenAI `text-embedding-3-small` (1536 dimensions)
- Vector storage: Convex vector search

### Chunking
- Strategy: Fixed-size with overlap
- Chunk size: 1000 characters
- Overlap: 200 characters

---

## Architecture

```
Dashboard                    Convex                         Worker
─────────────────────────────────────────────────────────────────────
Upload file      →    Store in Convex File Storage
                      Extract text (parse PDF/CSV/MD/TXT)
                      Chunk text
                      Generate embeddings (OpenAI)
                      Store chunks + vectors in documents table

                      ← List/delete documents

                                                    Agent calls search_knowledge tool
                                                              ↓
                                        Vector search → Return top chunks
                                                              ↓
                                                    Inject into agent context
```

---

## Data Model

### `documents` table
| Field | Type | Description |
|-------|------|-------------|
| tenantId | string | Tenant reference |
| fileId | string | Convex file storage ID |
| fileName | string | Original file name |
| fileType | string | pdf, txt, md, csv |
| fileSize | number | Size in bytes |
| status | string | pending, processing, ready, error |
| chunkCount | number | Number of chunks created |
| createdAt | number | Upload timestamp |
| errorMessage | string? | Error details if failed |

### `documentChunks` table
| Field | Type | Description |
|-------|------|-------------|
| tenantId | string | Tenant reference (for filtering) |
| documentId | string | Parent document reference |
| chunkIndex | number | Order within document |
| content | string | Text content of chunk |
| embedding | vector(1536) | OpenAI embedding vector |

---

## Implementation Tasks

Each task is ~15 minutes. Complete verification before proceeding to next task.

---

### Phase 1: Data Layer

#### Task 1: Create Convex schema
Add `documents` and `documentChunks` tables to Convex schema.

**Files:** `convex/schema.ts`

**Verify:**
- [ ] `npx convex dev` runs without schema errors
- [ ] Tables visible in Convex dashboard

---

#### Task 2: Create document mutations
Add `generateUploadUrl` and `create` mutations for documents.

**Files:** `convex/documents.ts`

**Verify:**
- [ ] Can call `generateUploadUrl` from Convex dashboard → returns URL
- [ ] Can call `create` with test data → document appears in table

---

#### Task 3: Create list and delete operations
Add `list` query and `delete` mutation for documents.

**Files:** `convex/documents.ts`

**Verify:**
- [ ] `list` query returns documents filtered by tenantId
- [ ] `delete` mutation removes document record
- [ ] Deleting document also removes associated file from storage

---

### Phase 2: Text Processing

#### Task 4: Create chunking utility
Implement fixed-size chunking with overlap (1000 chars, 200 overlap).

**Files:** `convex/lib/chunking.ts`

**Verify:**
- [ ] Unit test: 2500 char string → 3 chunks
- [ ] Unit test: chunks overlap by 200 chars
- [ ] Unit test: empty string → empty array

---

#### Task 5: Create text extraction for TXT/MD
Extract plain text from .txt and .md files.

**Files:** `convex/lib/extractText.ts`

**Verify:**
- [ ] Unit test: extracts text from .txt buffer
- [ ] Unit test: extracts text from .md buffer (preserves formatting)

---

#### Task 6: Create text extraction for CSV
Convert CSV to readable text format.

**Files:** `convex/lib/extractText.ts`

**Verify:**
- [ ] Unit test: CSV with headers → readable row-based text
- [ ] Unit test: handles quoted fields with commas

---

#### Task 7: Create text extraction for PDF
Parse PDF files to extract text content.

**Files:** `convex/lib/extractText.ts`, `package.json` (add pdf-parse)

**Verify:**
- [ ] Unit test: extracts text from simple PDF
- [ ] Unit test: handles multi-page PDF

---

### Phase 3: Document Processing

#### Task 8: Create processDocument action (without embeddings)
Background job that extracts text and creates chunks (no vectors yet).

**Files:** `convex/documents.ts`

**Verify:**
- [ ] Upload test .txt file → status changes: pending → processing → ready
- [ ] Chunks appear in `documentChunks` table with correct content
- [ ] Error in processing → status = "error" with message

---

#### Task 9: Add OpenAI embeddings to processDocument
Generate embeddings for each chunk and store vectors.

**Files:** `convex/documents.ts`, `.env` (OPENAI_API_KEY)

**Verify:**
- [ ] Chunks have `embedding` field populated (1536 dimensions)
- [ ] `chunkCount` on document matches actual chunk count

---

### Phase 4: Dashboard UI

#### Task 10: Create KnowledgeBase component shell
Basic component with upload zone and empty document list.

**Files:** `dashboard/app/components/KnowledgeBase.tsx`

**Verify:**
- [ ] Component renders in agent edit page
- [ ] Shows upload dropzone with accepted file types
- [ ] Shows "No documents" empty state

---

#### Task 11: Wire up file upload
Connect upload UI to Convex file storage and document creation.

**Files:** `dashboard/app/components/KnowledgeBase.tsx`

**Verify:**
- [ ] Select file → uploads to Convex
- [ ] Document record created with status "pending"
- [ ] Processing starts automatically

---

#### Task 12: Display document list with status
Show documents with name, size, status, and delete button.

**Files:** `dashboard/app/components/KnowledgeBase.tsx`

**Verify:**
- [ ] Documents display in list after upload
- [ ] Status updates reactively (pending → processing → ready)
- [ ] Delete button removes document

---

### Phase 5: Agent Integration

#### Task 13: Create vector search action
Implement `documentChunks.search` with vector similarity search.

**Files:** `convex/documentChunks.ts`

**Verify:**
- [ ] Search with test embedding returns relevant chunks
- [ ] Results filtered by tenantId
- [ ] Returns top 5 chunks with document metadata

---

#### Task 14: Add search_knowledge tool to worker
Define tool in agent configuration.

**Files:** `worker/src/tools/searchKnowledge.ts`, `worker/src/agent.ts`

**Verify:**
- [ ] Tool appears in agent tool list
- [ ] Tool schema validates correctly

---

#### Task 15: Implement search_knowledge handler
Complete tool implementation with embedding generation and Convex search.

**Files:** `worker/src/tools/searchKnowledge.ts`

**Verify:**
- [ ] E2E test: upload doc, ask agent question → agent uses tool → returns relevant info
- [ ] Response includes source attribution (document name)

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1. Data Layer | 1-3 | Convex schema and CRUD operations |
| 2. Text Processing | 4-7 | Chunking and file parsing utilities |
| 3. Document Processing | 8-9 | Background job with embeddings |
| 4. Dashboard UI | 10-12 | Upload and list components |
| 5. Agent Integration | 13-15 | Vector search and tool implementation |

**Total: 15 tasks × ~15 min = ~4 hours**

---

## File Parsing

| Type | Parsing Approach |
|------|------------------|
| .txt | Direct read |
| .md | Direct read (keep formatting) |
| .csv | Convert to readable text (row-based) |
| .pdf | Use `pdf-parse` or similar library |

---

## API Endpoints

### Convex Mutations/Queries
- `documents.generateUploadUrl` - Get signed upload URL
- `documents.create` - Create document record after upload
- `documents.list` - List tenant documents
- `documents.delete` - Delete document and chunks
- `documentChunks.search` - Vector search for chunks

---

## UI Components

### KnowledgeBase.tsx (Dashboard)
```
┌─────────────────────────────────────────────────┐
│ Knowledge Base                                  │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │  📄 Drop files here or click to upload      │ │
│ │     PDF, TXT, MD, CSV (max 10MB)            │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Documents (3 of 100MB used)                     │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📄 product-guide.pdf    2.3 MB   ✓ Ready  🗑│ │
│ │ 📄 faq.md               45 KB    ✓ Ready  🗑│ │
│ │ 📄 pricing.csv          12 KB    ⏳ Processing│ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Open Questions (Resolved)

- ~~Embedding model?~~ → OpenAI text-embedding-3-small
- ~~Vector DB?~~ → Convex built-in vector search
- ~~File storage?~~ → Convex File Storage

---

## Future Enhancements (Out of Scope)
- Web page URL ingestion
- Folder organization
- Re-embedding on model upgrade
- Chunk preview/editing
- Usage analytics per document

---

*Created: December 2024*
