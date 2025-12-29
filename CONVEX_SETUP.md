# Convex Setup Guide

This guide walks you through setting up Convex for the multi-tenant chat assistant.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- GitHub account (for Convex authentication)

## Step-by-Step Setup

### 1. Install Convex Dependencies

Install Convex in both the convex directory and the worker:

```bash
# Install in convex directory
cd convex
npm install

# Install in worker directory
cd ../worker
npm install
```

### 2. Initialize Convex Project

From the `convex/` directory, run:

```bash
npx convex dev
```

This will:
1. Open a browser window for GitHub authentication
2. Prompt you to create a new project or select existing
3. Generate `_generated/` folder with TypeScript types
4. Start the development server

**Important**: Keep this terminal window open - it watches for changes and auto-deploys.

### 3. Copy Your Deployment URL

After initialization, you'll see output like:

```
✔ Deployed 200 modules to https://fuzzy-lemur-123.convex.cloud
  Convex URL: https://fuzzy-lemur-123.convex.cloud
```

Copy this URL - you'll need it next.

### 4. Configure Worker Environment

Create a `.dev.vars` file in the `worker/` directory if it doesn't exist:

```bash
cd ../worker
touch .dev.vars
```

Add your Convex URL to `.dev.vars`:

```env
# Convex
CONVEX_URL=https://your-deployment.convex.cloud

# OpenAI (required for agents)
OPENAI_API_KEY=sk-...

# Langfuse (optional - for prompt management)
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://us.cloud.langfuse.com
```

### 5. Seed Initial Data

Now that Convex is running, seed it with example data.

Open the Convex dashboard: https://dashboard.convex.dev

Navigate to your project → Functions tab

Run the seed mutation:

```
Click "Run Function" → Select "seed:seedInitialData" → Click "Run"
```

This creates:
- 3 tenants (Platform, Acme Corp, Simple Bot Inc)
- 6 example agents (default, acme-support, acme-sales, simplebot-shopping, calendar-extractor, support-bot)

You can verify the data by going to the "Data" tab in the dashboard.

### 6. Update Worker to Use Convex

The worker is already configured to use Convex when `CONVEX_URL` is set. It will:

1. Try to load agent configs from Convex first
2. Fall back to D1 if Convex fails
3. Fall back to hardcoded configs if both fail

Priority: **Convex > D1 > Hardcoded**

### 7. Test the Integration

Start the worker in development mode:

```bash
cd ../worker
npm run dev
```

Test an API request (requires the widget or curl):

```bash
curl http://localhost:8787/api/chats \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "default",
    "message": "Hello!"
  }'
```

Check the worker logs - you should see:

```
[AgentConfig] Loaded from Convex: default
```

## Development Workflow

### Making Schema Changes

1. Edit `convex/schema.ts`
2. Convex automatically deploys changes
3. TypeScript types in `_generated/` update
4. Restart worker if needed for type changes

### Adding New Queries/Mutations

1. Create/edit files in `convex/` (e.g., `agents.ts`)
2. Export query/mutation functions
3. Convex auto-deploys
4. Import and use in worker:

```typescript
import { api } from "../../../convex/_generated/api";

const result = await client.query(api.agents.getByAgentId, {
  agentId: "default",
});
```

### Viewing Logs

Convex dashboard → Logs tab shows:
- Function calls
- Errors
- Performance metrics

### Inspecting Data

Convex dashboard → Data tab shows:
- All tables
- Live data
- Ability to edit/delete records

## Production Deployment

### 1. Deploy Convex to Production

```bash
cd convex
npx convex deploy --prod
```

This creates a separate production deployment with a new URL.

### 2. Update Worker Production Config

Add the production Convex URL to `worker/wrangler.toml`:

```toml
[vars]
CONVEX_URL = "https://your-prod-deployment.convex.cloud"
```

Or set it as a secret:

```bash
cd ../worker
wrangler secret put CONVEX_URL
# Paste: https://your-prod-deployment.convex.cloud
```

### 3. Deploy Worker

```bash
npm run deploy
```

## Troubleshooting

### Error: "CONVEX_URL environment variable is not set"

- Make sure `.dev.vars` exists in the worker directory
- Check that `CONVEX_URL` is set correctly
- Restart the worker dev server

### Error: "Cannot find module '../../../convex/_generated/api'"

- Run `npx convex dev` from the convex directory
- Wait for it to generate the `_generated/` folder
- The path is relative to the worker source files

### Agent config not loading from Convex

- Check Convex dashboard → Data → agents table
- Verify the agentId matches
- Check worker logs for error messages
- Make sure Convex dev server is running

### TypeScript errors in worker

- Ensure Convex dev server is running
- Check that `_generated/` folder exists
- Run `npx convex codegen` to regenerate types
- Restart TypeScript language server in your editor

## Migration from Hardcoded Configs

To migrate existing hardcoded configs to Convex:

1. The `seed.ts` script already includes examples
2. Modify `seed.ts` to match your agents
3. Run `npx convex run seed:seedInitialData`
4. Verify in dashboard
5. Remove hardcoded configs from `worker/src/tenants/config.ts` (optional - they serve as fallback)

## Next Steps

- [ ] Set up Clerk authentication for the dashboard
- [ ] Implement API key management (create, revoke, list)
- [ ] Add document upload and embeddings for RAG
- [ ] Configure production Convex deployment
- [ ] Set up monitoring and alerts

## Resources

- [Convex Documentation](https://docs.convex.dev)
- [Convex Dashboard](https://dashboard.convex.dev)
- [Convex TypeScript Client](https://docs.convex.dev/client/typescript)
- [Convex Schema Guide](https://docs.convex.dev/database/schemas)
