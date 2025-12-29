# Convex Setup Checklist

Follow these steps to complete the Convex setup:

## ☐ 1. Install Dependencies

```bash
# Install Convex dependencies
cd convex
npm install

# Install worker dependencies (adds convex client)
cd ../worker
npm install
```

## ☐ 2. Initialize Convex

```bash
cd ../convex
npx convex dev
```

**Expected output:**
- Browser opens for GitHub authentication
- Prompts to create/select project
- Shows: `Convex URL: https://your-deployment.convex.cloud`
- Generates `_generated/` folder
- Server starts watching for changes

**⚠️ Keep this terminal running!**

## ☐ 3. Configure Worker

Copy your Convex URL from step 2.

Create `worker/.dev.vars` (if it doesn't exist):

```bash
cd ../worker
touch .dev.vars
```

Add to `worker/.dev.vars`:

```env
# Convex
CONVEX_URL=https://your-deployment.convex.cloud

# OpenAI (required)
OPENAI_API_KEY=sk-...

# Langfuse (optional)
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://us.cloud.langfuse.com
```

## ☐ 4. Seed Database

Open Convex Dashboard: https://dashboard.convex.dev

Navigate to: Your Project → Functions tab

Run the seed function:
1. Click "Run Function"
2. Select `seed:seedInitialData`
3. Click "Run"

**Expected result:**
```json
{
  "success": true,
  "tenantsCreated": 3,
  "agentsCreated": 6
}
```

## ☐ 5. Verify Data

In Convex Dashboard → Data tab:

- ✅ `tenants` table has 3 rows
- ✅ `agents` table has 6 rows
- ✅ Agent IDs: default, acme-support, acme-sales, simplebot-shopping, calendar-extractor, support-bot

## ☐ 6. Test Worker Integration

Start the worker:

```bash
cd ../worker
npm run dev
```

**Check logs for:**
```
[AgentConfig] Loaded from Convex: default
```

## ☐ 7. Test API Request

In a new terminal:

```bash
curl http://localhost:8787/api/health
```

Or test the chat endpoint with the widget.

## ☐ 8. Verify Fallback Chain

To test the fallback chain works:

1. Stop Convex dev server
2. Worker should log: `[AgentConfig] Convex fetch failed`
3. Falls back to: `[AgentConfig] Loaded from memory: default`
4. Restart Convex dev server
5. Worker should resume using Convex

## 🎉 Success Criteria

- [ ] Convex dev server running
- [ ] `_generated/` folder exists in convex/
- [ ] Worker logs show "Loaded from Convex"
- [ ] Database has 3 tenants and 6 agents
- [ ] API requests work
- [ ] No TypeScript errors

## 🔧 Troubleshooting

### "Cannot find module '../../../convex/_generated/api'"

**Solution:**
- Ensure `npx convex dev` is running
- Wait for `_generated/` folder to appear
- Restart worker dev server

### "CONVEX_URL environment variable is not set"

**Solution:**
- Check `worker/.dev.vars` exists
- Verify CONVEX_URL is set correctly
- Restart worker dev server

### No data in Convex dashboard

**Solution:**
- Run `seed:seedInitialData` function
- Check Functions tab → Logs for errors
- Verify schema deployed successfully

### Worker still using hardcoded configs

**Solution:**
- Verify CONVEX_URL in `.dev.vars`
- Check worker logs for error messages
- Ensure Convex dev server is running
- Try restarting worker

## 📚 Next Steps

After completing this checklist:

1. **Phase 1 Completion**: Build dashboard UI to manage agents
2. **Phase 3**: Add Clerk authentication
3. **Phase 4**: Implement eval runner
4. **Phase 5**: Add RAG with document uploads

## 🔗 Helpful Links

- [Convex Dashboard](https://dashboard.convex.dev)
- [Convex Documentation](https://docs.convex.dev)
- [Setup Guide](./docs/convex.md)
- [Phase 2 Summary](./PHASE2_SUMMARY.md)
