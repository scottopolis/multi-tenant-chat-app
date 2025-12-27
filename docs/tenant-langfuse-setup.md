# Tenant Langfuse Setup Guide

## Two Modes

### Mode 1: Platform-Managed (Simple)
**You control all prompts in your Langfuse account**

```typescript
// worker/src/tenants/config.ts
{
  tenantId: 'acme',
  name: 'Acme Corp',
  // No langfuse config → uses your .dev.vars keys
}
```

**In your Langfuse:**
- Create prompt: `base-assistant`
- Add label: `acme` → Custom version for Acme
- Add label: `default` → Generic version

**Pros:** Simple, you control everything  
**Cons:** Tenants can't self-manage

---

### Mode 2: Tenant-Managed (Enterprise)
**Each tenant uses their own Langfuse account**

```typescript
// worker/src/tenants/config.ts
{
  tenantId: 'enterprise',
  name: 'Enterprise Corp',
  langfuse: {
    publicKey: 'pk-lf-their-key-xxx',
    secretKey: 'sk-lf-their-key-xxx', // Encrypt in production!
    promptName: 'support-agent',
  },
}
```

**Pros:** Full tenant control, data isolation  
**Cons:** More setup, must store tenant credentials

---

## Quick Start

### 1. Platform Setup (.dev.vars)

```bash
# Your Langfuse credentials (Mode 1 default)
LANGFUSE_PUBLIC_KEY=pk-lf-your-key
LANGFUSE_SECRET_KEY=sk-lf-your-key
```

### 2. Add Tenant Config

Edit `worker/src/tenants/config.ts`:

```typescript
const TENANT_CONFIGS = {
  'default': {
    tenantId: 'default',
    // Uses platform keys from .dev.vars
  },
  'customer-1': {
    tenantId: 'customer-1',
    // Uses platform keys with label "customer-1"
  },
  'enterprise-1': {
    tenantId: 'enterprise-1',
    langfuse: {
      publicKey: 'pk-lf-enterprise-xxx',
      secretKey: 'sk-lf-enterprise-xxx',
      promptName: 'their-prompt',
    },
  },
};
```

### 3. Create Prompts in Langfuse

**Platform-managed:** Create `base-assistant` with labels  
**Tenant-managed:** Tenant creates prompt in their account

### 4. Test

```bash
# Start worker
cd worker && npm run dev

# Test platform-managed
curl -X POST "http://localhost:8787/api/chats?agent=customer-1"

# Test tenant-managed  
curl -X POST "http://localhost:8787/api/chats?agent=enterprise-1"
```

---

## Production: Move to Database

Replace hardcoded config with D1:

```typescript
export async function getTenantConfig(
  tenantId: string, 
  env: Env
): Promise<TenantConfig> {
  const result = await env.DB.prepare(
    'SELECT * FROM tenant_configs WHERE tenant_id = ?'
  ).bind(tenantId).first();
  
  return result ? {
    tenantId: result.tenant_id,
    langfuse: result.langfuse_public_key ? {
      publicKey: result.langfuse_public_key,
      secretKey: decrypt(result.langfuse_secret_key),
      promptName: result.langfuse_prompt_name,
    } : undefined,
    model: result.model,
  } : DEFAULT_CONFIG;
}
```

**Important:** Encrypt `langfuse_secret_key` in database!

---

## How It Works

```
Request: ?agent=acme
  ↓
1. Load tenant config (hardcoded now, DB later)
  ↓
2. Check for tenant's langfuse config:
   - Has keys? Use tenant's Langfuse account
   - No keys? Use platform's Langfuse (from .dev.vars)
  ↓
3. Fetch prompt and run agent
```

---

## FAQ

**Q: Do I need to update .dev.vars for every tenant?**  
A: No! Only if using Mode 1 (platform-managed). Mode 2 tenants have their own keys in the config.

**Q: Can I mix modes?**  
A: Yes! Some tenants can use your Langfuse, others use their own.

**Q: What if Langfuse fails?**  
A: Falls back to default hardcoded prompt. Chat continues working.

**Q: How do tenants update prompts?**  
A: Mode 1: They contact you. Mode 2: They edit in their Langfuse account.

---

## Next Steps

- ✅ MVP: Hardcoded configs (current)
- ⏭️ Phase 1: Store in D1 database  
- ⏭️ Phase 2: Admin API for config management
- ⏭️ Phase 3: Tenant self-service dashboard

