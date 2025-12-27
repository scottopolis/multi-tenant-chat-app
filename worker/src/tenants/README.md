# Tenant Configuration Module

## Current State (MVP)

Tenant configs are **hardcoded** in `config.ts` for quick testing.

## Database Migration (Future)

When ready to move to production, just:

### 1. Create D1 Database

```bash
# Create database
wrangler d1 create tenant-configs

# Add to wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "tenant-configs"
database_id = "xxx"
```

### 2. Run Migration

```sql
-- migrations/0001_create_tenant_configs.sql
CREATE TABLE tenant_configs (
  tenant_id TEXT PRIMARY KEY,
  name TEXT,
  
  -- Langfuse (optional, encrypted)
  langfuse_public_key TEXT,
  langfuse_secret_key TEXT,
  langfuse_host TEXT,
  langfuse_prompt_name TEXT,
  langfuse_label TEXT,
  
  -- Model
  model TEXT DEFAULT 'gpt-4.1-mini',
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tenant_id ON tenant_configs(tenant_id);
```

### 3. Update Bindings Type

```typescript
// worker/src/index.ts
type Bindings = {
  OPENROUTER_API_KEY: string;
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_HOST?: string;
  DB: D1Database; // Add this
};
```

### 4. Pass DB to getTenantConfig

```typescript
// worker/src/index.ts (in message handler)
const result = await runAgent({
  messages,
  apiKey,
  orgId,
  model,
  env: {
    LANGFUSE_PUBLIC_KEY: c.env.LANGFUSE_PUBLIC_KEY,
    LANGFUSE_SECRET_KEY: c.env.LANGFUSE_SECRET_KEY,
    LANGFUSE_HOST: c.env.LANGFUSE_HOST,
    DB: c.env.DB, // Add this
  },
});

// worker/src/agents/index.ts
const tenantConfig = await getTenantConfig(orgId, env?.DB ? { DB: env.DB } : undefined);
```

### 5. Done!

The code automatically switches from hardcoded configs to DB queries. No other changes needed!

## Features

- ✅ **5-minute cache** - Reduces DB queries
- ✅ **Graceful fallback** - DB errors don't break chats
- ✅ **Cache invalidation** - Call `invalidateTenantCache(tenantId)` after updates

## Admin API (Future)

When you add admin endpoints:

```typescript
// Update tenant config
app.put('/api/admin/tenants/:id/config', async (c) => {
  const tenantId = c.req.param('id');
  const config = await c.req.json();
  
  await env.DB.prepare(`
    UPDATE tenant_configs 
    SET langfuse_public_key = ?, model = ?
    WHERE tenant_id = ?
  `).bind(config.langfusePublicKey, config.model, tenantId).run();
  
  // Clear cache so next request gets fresh data
  invalidateTenantCache(tenantId);
  
  return c.json({ success: true });
});
```

## Security Notes

**TODO before production:**

1. **Encrypt secret keys** before storing in DB
2. **Decrypt** when fetching (see `fetchFromDatabase` function)
3. Use Cloudflare Workers Secrets or KV for encryption keys
4. Never log or expose secret keys in API responses

