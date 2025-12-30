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

## Implementation

### Phase 1: Document Upload & Processing

#### Dashboard
- Add "Knowledge Base" section to agent config
- File upload component (drag & drop or click)
- Document list with name, size, status, delete button
- Show simple status: uploading → processing → ready (or error)

#### Convex
- `documents.upload` mutation: store file, create document record
- `documents.list` query: get documents for tenant
- `documents.delete` mutation: remove document, chunks, and file
- Background job: `processDocument`
  - Extract text based on file type
  - Chunk text (1000 chars, 200 overlap)
  - Call OpenAI embeddings API
  - Store chunks with vectors

### Phase 2: Agent Integration

#### Worker
- Add `search_knowledge` tool to agent:
  ```typescript
  {
    name: "search_knowledge",
    description: "Search the knowledge base for relevant information",
    parameters: {
      query: { type: "string", description: "Search query" }
    }
  }
  ```
- Tool implementation:
  - Generate embedding for query
  - Call Convex vector search (top 5 chunks)
  - Return formatted context with source attribution

#### Convex
- `documentChunks.search` action:
  - Vector similarity search filtered by tenantId
  - Return top K chunks with document metadata

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
