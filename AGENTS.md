# AGENTS.md

Multi-tenant chat assistant platform with embeddable React widget and Cloudflare Worker backend using TanStack AI + OpenRouter for provider-agnostic model access.

## Project Structure

| Directory | Description |
|-----------|-------------|
| `worker/` | Cloudflare Worker API - handles chat requests, OpenAI integration, tool execution, and voice agent webhooks |
| `widget/` | Embeddable React chat widget - the end-user chat interface that can be embedded on any website |
| `dashboard/` | Admin dashboard - where tenants configure agents, tools, voice settings, and view analytics |
| `convex-backend/` | Convex backend - persistent storage for agents, conversations, and tenant data |
| `mcp/` | MCP server - For testing only, Model Context Protocol server for external tool integrations |
| `docs/` | Documentation |

## Commands

### Root (starts all projects)
```bash
npm run dev      # Start worker, widget, dashboard, and convex concurrently
```

### Worker
```bash
cd worker
npm install
npm run dev      # Start dev server on :8787
npm test         # Run Vitest tests
```

### Widget
```bash
cd widget
npm install
npm run dev      # Start dev server
npm test         # Run Vitest unit tests
npm run test:e2e # Run Playwright E2E tests (requires worker running)
```

## Documentation

- [README.md](./README.md) - Quick start and features
- [PLAN.md](./PLAN.md) - Architecture and implementation plan
- [docs/](./docs/) - API reference, tools/agents, deployment guides
- [specs/](./specs/) - Feature specifications

## Current Focus (Dashboard UX)

- Branch: `codex/dashboard-ux-onboarding`
- Recent work: added a guided launch checklist on the dashboard home, deep links to agent tabs, prompt templates in the agent form, and a readiness badge in the agents list.
- Key docs: `docs/launch-plan.md`, `docs/ux-improvements.md`, `docs/dashboard-ux.md`

## Next Steps

- Decide whether to convert the agent setup into a wizard or keep tabs with in-form progress and a “Next” CTA.
- Improve embed flow validation (copy + verification check) and security guidance.
- Consider upgrading the agents list into a card view with quick actions (Edit Prompt, Embed, Domains, Voice).
