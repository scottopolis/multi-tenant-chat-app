# AGENTS.md

Multi-tenant chat assistant platform with embeddable React widget and Cloudflare Worker backend using OpenAI Agents SDK.

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
