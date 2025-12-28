# Database Implementation Guide

This document outlines the hybrid database architecture using **Convex** (configs/RAG) and **Cloudflare D1** (conversations).

---

## Architecture Overview

| Database | Purpose | Access Pattern |
|----------|---------|----------------|
| **Convex** | Tenant configs, API keys, documents, embeddings | Cold path - infrequent reads/writes |
| **D1** | Chats and messages | Hot path - frequent reads/writes, lowest latency |

---

## Cloudflare D1 (Conversations)

### Purpose
Store chat sessions and messages with low latency from the Cloudflare Worker.

### Tables

#### `chats`
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| org_id | TEXT | NOT NULL, indexed |
| title | TEXT | nullable |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### `messages`
| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| chat_id | TEXT | NOT NULL, FOREIGN KEY → chats(id) |
| role | TEXT | NOT NULL (user/assistant/system) |
| content | TEXT | NOT NULL |
| created_at | DATETIME | DEFAULT CURRENT_TIMESTAMP |

### Indexes
- `idx_chats_org_id` on `chats(org_id)` - for listing tenant's chats
- `idx_messages_chat_id` on `messages(chat_id)` - for loading chat history

### Multi-Tenant Isolation
- **All queries must filter by `org_id`** - never expose chats across tenants
- Worker middleware extracts `org_id` from authenticated request
- `getChat()` must verify `chat.org_id === requestingOrgId` before returning
- `listChats()` always filters by `org_id`

### Query Patterns
1. **List chats for org**: `SELECT * FROM chats WHERE org_id = ? ORDER BY created_at DESC`
2. **Get chat by ID**: `SELECT * FROM chats WHERE id = ? AND org_id = ?`
3. **Get messages for chat**: `SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC`
4. **Create chat**: `INSERT INTO chats (id, org_id, title, created_at) VALUES (?, ?, ?, ?)`
5. **Add message**: `INSERT INTO messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`

### Setup Instructions
1. Create D1 database: `wrangler d1 create chat-assistant`
2. Add binding to `wrangler.toml`:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "chat-assistant"
   database_id = "<id-from-step-1>"
   ```
3. Create migration file in `worker/migrations/0001_init.sql`
4. Run migration: `wrangler d1 migrations apply chat-assistant`
5. Update `worker/src/storage.ts` to use D1 instead of in-memory Maps
6. Update Bindings type in `worker/src/index.ts` to include `DB: D1Database`

### Migration from In-Memory
- Replace `Map<string, Chat>` with D1 queries
- Keep same function signatures (`createChat`, `getChat`, `listChats`, `addMessage`, `getMessages`)
- Make all functions async (they currently sync)
- Add `orgId` parameter to `getChat()` for ownership verification

---

## Convex (Configs & RAG)

### Purpose
Store tenant configurations, API keys, documents, and vector embeddings.

### Tables (Convex Schema)

#### `tenants`
| Field | Type | Description |
|-------|------|-------------|
| _id | Id | Convex auto ID |
| clerkOrgId | string | Clerk organization ID (indexed, unique) |
| name | string | Tenant display name |
| plan | string | Billing tier (free/pro/enterprise) |
| createdAt | number | Unix timestamp |

#### `agents`
| Field | Type | Description |
|-------|------|-------------|
| _id | Id | Convex auto ID |
| agentId | string | Unique agent identifier (indexed) |
| tenantId | Id | Reference to tenants table |
| orgId | string | Organization/tenant identifier |
| name | string | Agent display name |
| systemPrompt | string? | System prompt text (optional) |
| model | string | Model ID (gpt-4.1-mini, gpt-4o, o1, etc.) |
| mcpServers | array? | MCP server configurations [{url, authHeader?, transport?}] |
| langfuse | object? | Optional Langfuse config {publicKey, secretKey, host?, promptName?, label?} |
| outputSchema | string? | JSON-serialized Zod schema for structured output |
| createdAt | number | Unix timestamp |
| updatedAt | number | Unix timestamp |

#### `apiKeys`
| Field | Type | Description |
|-------|------|-------------|
| _id | Id | Convex auto ID |
| tenantId | Id | Reference to tenants table |
| keyHash | string | Hashed API key (indexed) |
| keyPrefix | string | First 8 chars for display (e.g., "sk_live_abc...") |
| name | string | Key name/description |
| lastUsedAt | number | Last usage timestamp |
| createdAt | number | Unix timestamp |

#### `documents`
| Field | Type | Description |
|-------|------|-------------|
| _id | Id | Convex auto ID |
| tenantId | Id | Reference to tenants table |
| agentId | Id | Reference to agents table |
| storageId | Id | Convex file storage ID |
| filename | string | Original filename |
| mimeType | string | File MIME type |
| status | string | processing/ready/failed |
| createdAt | number | Unix timestamp |

#### `embeddings`
| Field | Type | Description |
|-------|------|-------------|
| _id | Id | Convex auto ID |
| documentId | Id | Reference to documents table |
| tenantId | Id | Reference to tenants table (denormalized for queries) |
| chunkIndex | number | Position in document |
| text | string | Chunk text content |
| embedding | array | Vector embedding (float[]) |

### Indexes
- `tenants.by_clerk_org` on `clerkOrgId` - lookup by Clerk org
- `agents.by_agent_id` on `agentId` - lookup by agent ID (unique)
- `agents.by_tenant` on `tenantId` - list agents for tenant
- `agents.by_org_id` on `orgId` - list agents for org
- `apiKeys.by_hash` on `keyHash` - API key validation
- `apiKeys.by_tenant` on `tenantId` - list keys for tenant
- `documents.by_tenant` on `tenantId` - list docs for tenant
- `embeddings.by_tenant` on `tenantId` - vector search scoped to tenant

### Vector Search
- Use Convex vector index on `embeddings` table
- Always filter by `tenantId` to ensure isolation
- Query: "Find top-k similar embeddings WHERE tenantId = X"

### Multi-Tenant Isolation
- **All Convex queries must filter by `tenantId`**
- Worker validates API key → extracts `tenantId` → passes to all queries
- Dashboard uses Clerk org ID → maps to `tenantId` → scopes all queries
- Vector search must include `tenantId` filter to prevent cross-tenant RAG

### Setup Instructions
1. Create Convex project: `npx convex dev`
2. Define schema in `convex/schema.ts`
3. Create query/mutation functions in `convex/` directory
4. Add Convex client to worker (use HTTP client, not realtime)
5. Add Convex client to dashboard (use React hooks)
6. Set `CONVEX_URL` environment variable in both apps

---

## Authentication Flow

### Current (MVP)
- `?agent=<id>` query param maps to `orgId`
- No real authentication

### Future (Production)

#### Widget → Worker
1. Widget includes API key in `Authorization: Bearer <key>` header
2. Worker hashes key, looks up in Convex `apiKeys` table
3. If valid, extract `tenantId` and set on request context
4. All subsequent queries use this `tenantId`

#### Dashboard → Convex
1. User signs in via Clerk
2. Clerk provides `orgId` in session
3. Dashboard queries Convex with `clerkOrgId` filter
4. Convex functions verify Clerk JWT before executing

### API Key Validation (Worker)
```
Request → Extract Bearer token → Hash token → Query Convex apiKeys.by_hash
  → If found: set orgId = apiKey.tenantId, continue
  → If not found: return 401 Unauthorized
```

---

## Implementation Checklist

### D1 Setup
- [ ] Create D1 database via Wrangler
- [ ] Add D1 binding to wrangler.toml
- [ ] Create migration file with schema
- [ ] Run migration
- [ ] Update storage.ts to use D1
- [ ] Add orgId verification to getChat()
- [ ] Test multi-tenant isolation

### Convex Setup
- [ ] Initialize Convex project
- [ ] Define schema.ts with all tables
- [ ] Create indexes for all query patterns
- [ ] Implement tenant CRUD functions
- [ ] Implement agent CRUD functions
- [ ] Implement API key functions (create, validate, revoke)
- [ ] Set up vector index for embeddings
- [ ] Add Convex HTTP client to worker
- [ ] Test tenant isolation

### Worker Integration
- [ ] Add D1 binding type to Bindings
- [ ] Add Convex client initialization
- [ ] Update auth middleware to validate API keys via Convex
- [ ] Update storage layer to use D1
- [ ] Update agent config loading to use Convex
- [ ] Add orgId verification on all endpoints

### Dashboard Integration
- [ ] Add Convex React provider
- [ ] Create hooks for tenant/agent queries
- [ ] Implement API key management UI
- [ ] Connect agent config forms to Convex mutations

---

## Security Considerations

1. **Never expose raw API keys** - only store hashed values in Convex
2. **Always filter by tenant** - every query must include orgId/tenantId
3. **Verify ownership** - check chat.org_id matches requesting org before returning
4. **Rate limit by API key** - track usage, enforce limits
5. **Audit logging** - log API key usage for security monitoring
6. **Key rotation** - support creating new keys and revoking old ones

---

*This document is a specification. Implementation should follow these patterns exactly to ensure multi-tenant security.*

