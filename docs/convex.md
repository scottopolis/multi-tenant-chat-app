# Convex Backend

Convex is the primary database for storing tenant and agent configurations. It provides real-time sync, type-safe queries, and built-in vector search for RAG.

## Quick Start

```bash
# 1. Install and start Convex
cd convex-backend
npm install
npm run dev    # Opens browser for GitHub auth, starts watching

# 2. Copy the deployment URL from output
#    e.g., https://fuzzy-lemur-123.convex.cloud

# 3. Add to worker/.dev.vars
CONVEX_URL=https://your-deployment.convex.cloud

# 4. Seed example data (in Convex dashboard)
#    Functions → seed:seedInitialData → Run
```

The worker automatically loads agent configs from Convex when `CONVEX_URL` is set.

## Data Model

| Table | Purpose |
|-------|---------|
| `tenants` | Organizations using the platform |
| `agents` | Chatbot configs (prompts, models, integrations) |
| `apiKeys` | Widget authentication keys |
| `documents` | Uploaded files for RAG |
| `embeddings` | Vector embeddings for RAG |

### Key Fields

**Agents:**
- `agentId` - Unique identifier (e.g., `acme-support`)
- `systemPrompt` - Default system prompt
- `model` - Model ID (e.g., `gpt-4.1-mini`)
- `langfuse*` - Optional Langfuse integration
- `mcpServers` - JSON array of MCP server configs

## How the Worker Uses Convex

The worker calls Convex via HTTP API (not imports) to avoid cross-package issues:

```typescript
const response = await fetch(`${convexUrl}/api/query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    path: 'agents:getByAgentId',
    args: { agentId: 'my-agent' },
  }),
});
```

**Priority:** Convex → D1 → Hardcoded defaults

## Available Functions

| Function | Type | Description |
|----------|------|-------------|
| `agents:getByAgentId` | Query | Get agent config by ID |
| `agents:listByTenant` | Query | List agents for a tenant |
| `agents:create` | Mutation | Create new agent |
| `agents:update` | Mutation | Update agent config |
| `tenants:create` | Mutation | Create new tenant |
| `apiKeys:validate` | Query | Validate an API key |
| `seed:seedInitialData` | Mutation | Populate example data |

---

## Setup Guide

### Prerequisites

- Node.js 18+
- GitHub account (for Convex auth)

### 1. Initialize Convex

```bash
cd convex-backend
npm install
npm run dev
```

This opens a browser for GitHub auth, creates your project, and starts watching for changes. Keep this terminal open.

### 2. Configure Worker

Create `worker/.dev.vars`:

```env
CONVEX_URL=https://your-deployment.convex.cloud
OPENAI_API_KEY=sk-...
```

### 3. Seed Data

In the [Convex Dashboard](https://dashboard.convex.dev):

1. Go to Functions tab
2. Select `seed:seedInitialData`
3. Click Run

This creates example tenants and agents.

### 4. Test

```bash
cd worker
npm run dev
```

```bash
curl http://localhost:8787/api/chats \
  -H "Content-Type: application/json" \
  -d '{"agentId": "default", "message": "Hello!"}'
```

You should see `[AgentConfig] Loaded from Convex: default` in logs.

---

## Development Workflow

### Making Changes

1. Edit files in `convex-backend/convex/`
2. Convex auto-deploys changes
3. Types in `_generated/` update automatically

### Adding Functions

```typescript
// convex-backend/convex/myTable.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getById = query({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("myTable")
      .filter((q) => q.eq(q.field("id"), args.id))
      .first();
  },
});
```

Call from worker:

```typescript
await fetch(`${convexUrl}/api/query`, {
  method: 'POST',
  body: JSON.stringify({ path: 'myTable:getById', args: { id: 'abc' } }),
});
```

### Multi-Tenant Security

All queries must filter by `tenantId`:

```typescript
// ✅ Correct
await ctx.db.query("agents")
  .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
  .collect();

// ❌ Wrong - exposes all tenants
await ctx.db.query("agents").collect();
```

---

## Production Deployment

### 1. Deploy Convex

```bash
cd convex-backend
npx convex deploy --prod
```

### 2. Configure Worker

Add production URL to `worker/wrangler.toml`:

```toml
[vars]
CONVEX_URL = "https://your-prod.convex.cloud"
```

Or use a secret:

```bash
wrangler secret put CONVEX_URL
```

### 3. Deploy Worker

```bash
npm run deploy
```

---

## Troubleshooting

| Error | Solution |
|-------|----------|
| "CONVEX_URL not set" | Check `worker/.dev.vars` exists and restart worker |
| Agent not loading | Verify `agentId` matches in Convex dashboard Data tab |
| TypeScript errors | Run `npx convex codegen` in convex-backend |

## Resources

- [Convex Documentation](https://docs.convex.dev)
- [Convex Dashboard](https://dashboard.convex.dev)
- [Schema Reference](https://docs.convex.dev/database/schemas)
