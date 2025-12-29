# Convex Backend Setup

This directory contains the Convex backend for the multi-tenant chat assistant.

## Setup Instructions

### 1. Install Dependencies

From the `convex-backend/` directory:

```bash
npm install
```

### 2. Initialize Convex Project

Run the Convex development server:

```bash
npm run dev
```

This will:
- Authenticate you via GitHub
- Create a new Convex project (or link to existing)
- Generate `convex/_generated/` folder with TypeScript types
- Start watching for changes

### 3. Get Your Deployment URL

After running `npm run dev`, you'll see output like:

```
Convex URL: https://your-project-123.convex.cloud
```

Copy this URL - you'll need it for the worker configuration.

### 4. Configure Worker

Add the Convex URL to your worker's environment variables.

In `worker/.dev.vars`:
```
CONVEX_URL=https://your-project-123.convex.cloud
```

In `worker/wrangler.toml` (for production):
```toml
[vars]
CONVEX_URL = "https://your-project-123.convex.cloud"
```

### 5. Seed Initial Data (Optional)

You can seed the database with example agents using the Convex dashboard or by creating a mutation.

Example: Create a tenant and agent via Convex dashboard:

```javascript
// Go to https://dashboard.convex.dev
// Run this in the Console tab:

// Create tenant
const tenantId = await api.tenants.create({
  clerkOrgId: "org_test123",
  name: "Test Organization",
  plan: "free"
});

// Create agent
await api.agents.create({
  agentId: "test-agent",
  tenantId: tenantId,
  orgId: "org_test123",
  name: "Test Agent",
  systemPrompt: "You are a helpful assistant.",
  model: "gpt-4.1-mini"
});
```

## Schema

The schema is defined in `convex/schema.ts` and includes:

- **tenants** - Organizations/customers
- **agents** - Chatbot configurations
- **apiKeys** - API keys for widget authentication
- **documents** - Uploaded files for RAG
- **embeddings** - Vector embeddings for RAG

## Functions

### Queries (Read)
- `agents.getByAgentId` - Get agent config by agentId
- `agents.listByTenant` - List agents for a tenant
- `tenants.getByClerkOrgId` - Get tenant by Clerk org ID
- `apiKeys.validate` - Validate API key

### Mutations (Write)
- `agents.create` - Create new agent
- `agents.update` - Update agent config
- `agents.remove` - Delete agent
- `tenants.create` - Create new tenant
- `apiKeys.create` - Generate API key

## Development Workflow

1. Make changes to schema or functions
2. Convex automatically deploys changes
3. TypeScript types in `convex/_generated/` update automatically
4. Worker can immediately use new functions

## Production Deployment

When ready to deploy:

```bash
npm run deploy
```

This creates a production deployment with a separate URL. Update your worker's production environment variables accordingly.

## Multi-Tenant Security

**CRITICAL**: All queries must filter by `tenantId` to prevent cross-tenant data access.

Example:
```typescript
// ✅ GOOD - Filters by tenantId
await ctx.db
  .query("agents")
  .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
  .collect();

// ❌ BAD - No tenant filtering
await ctx.db.query("agents").collect();
```

## Monitoring

Access the Convex dashboard to:
- View logs and errors
- Monitor query performance
- Inspect data
- Run ad-hoc queries

Dashboard: https://dashboard.convex.dev
