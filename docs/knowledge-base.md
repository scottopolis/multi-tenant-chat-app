# Knowledge Base (RAG)

The knowledge base feature lets agents search uploaded documents to provide context-aware responses. It uses Convex RAG for vector storage and retrieval.

## How It Works

1. **Upload**: Files are uploaded via the dashboard or API
2. **Process**: Text is extracted, chunked, and embedded using OpenAI's embedding model
3. **Store**: Embeddings are stored in Convex with namespace isolation per agent
4. **Search**: When an agent receives a message, it can call the `search_knowledge_base` tool to find relevant content

## Multi-Tenant Isolation

Each agent has its own namespace in the vector store. Documents uploaded to one agent are never visible to other agents, even within the same tenant.

Namespaces follow the pattern: `agent:{agentConvexId}`

## Supported File Types

Currently supported:
- `.txt` - Plain text files
- `.md` - Markdown files

Future support planned for PDF and other document formats.

## File Size Limits

Maximum file size: 10MB

Large files are automatically chunked for optimal retrieval.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents` | GET | List documents for an agent |
| `/api/documents/upload` | POST | Upload a file (multipart form) |
| `/api/documents/:fileId` | DELETE | Delete a document |

All endpoints require the `x-agent-id` header.

## Tool: search_knowledge_base

Agents automatically have access to the `search_knowledge_base` tool when they have documents uploaded. The tool:

- Takes a `query` string parameter
- Returns the most relevant text chunks from uploaded documents
- Is available to both chat and voice agents

The tool only appears if the agent has a valid `agentConvexId` and the Convex URL is configured.

## Dashboard Integration

In the dashboard, each agent has a "Knowledge Base" section where you can:

- View all uploaded documents
- Upload new files via drag-and-drop or file picker
- Delete documents
- See processing status

## Architecture Overview

```
Dashboard/API → Worker → Convex Actions → Convex RAG Component
                              ↓
                         File Storage
                              ↓
                      Vector Embeddings
```

The worker acts as a proxy to Convex, which handles:
- File storage in Convex's built-in file storage
- Text extraction and chunking
- Embedding generation via OpenAI
- Vector similarity search

## Embedding Model

Uses OpenAI's `text-embedding-3-small` model (1536 dimensions) for generating embeddings. This provides a good balance of quality and cost.

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| `search_knowledge_base` tool not available | Missing `agentConvexId` or `CONVEX_URL` | Verify agent exists in Convex and env is configured |
| Upload fails | File too large or unsupported type | Check file is under 10MB and is .txt or .md |
| Search returns no results | No documents uploaded or query doesn't match | Upload relevant documents, try different search terms |
| Documents not appearing | Processing still in progress | Wait for status to change to "ready" |
