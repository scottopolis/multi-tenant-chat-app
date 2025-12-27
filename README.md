# Multi-Tenant Chat Assistant

A minimal chat assistant platform with a React widget frontend and Cloudflare Worker backend. Built with OpenRouter for flexible LLM model selection, featuring real-time streaming, tool calling, and a modern React UI.

**Repository:** https://github.com/scottopolis/multi-tenant-chat-app

## Project Structure

```
multi-tenant-chat-app/
├── worker/         # Cloudflare Worker API (Hono + AI SDK + OpenRouter)
├── widget/         # React chat widget (Vite + TanStack Query + shadcn/ui)
├── docs/           # Documentation
├── PLAN.md         # Detailed implementation plan
├── QUICKSTART.md   # 5-minute setup guide
└── README.md
```

## Quick Start

See [QUICKSTART.md](./QUICKSTART.md) for a 5-minute setup guide.

### Prerequisites

- Node.js 18+
- npm or pnpm
- Cloudflare account (for deployment)
- OpenRouter API key ([Get one here](https://openrouter.ai/))

### Clone the Repository

```bash
git clone https://github.com/scottopolis/multi-tenant-chat-app.git
cd multi-tenant-chat-app
```

### Development

1. **Set up the Worker:**
```bash
cd worker
npm install
npm run dev
```

2. **Set up the Widget:**
```bash
cd widget
npm install
npm run dev
```

3. **Configure environment variables:**

Worker (use wrangler secrets):
```bash
cd worker
npx wrangler secret put OPENROUTER_API_KEY
```

Widget (create `.env`):
```
VITE_API_URL=http://localhost:8787
```

## Features

- ✅ Real-time streaming chat with SSE
- ✅ OpenRouter integration for flexible model selection
- ✅ Tool/function calling support
- ✅ Agent routing via query parameters (MVP multi-tenancy)
- ✅ Comprehensive test coverage (unit + E2E)
- 🚧 Authentication (placeholder)
- 🚧 Persistent storage (in-memory for now)
- 🚧 Langfuse integration (prepared)

## Testing

This project includes comprehensive test coverage for both backend and frontend:

### Worker Tests (Backend)

Run unit tests with Vitest:
```bash
cd worker
npm test              # Run tests once
npm run test:watch    # Watch mode
```

**Test Coverage:**
- Storage layer tests (`storage.test.ts`)
- API endpoint validation
- Tool/agent functionality

### Widget Tests (Frontend)

**Unit Tests:**
```bash
cd widget
npm test              # Run tests once
npm run test:watch    # Watch mode
```

**E2E Tests with Playwright:**
```bash
cd widget
npm run test:e2e      # Run E2E tests
npm run test:e2e:ui   # Run with Playwright UI
```

**E2E Test Coverage:**
- Complete chat flow: load → send message → receive streaming response
- Multi-turn conversations with tool usage
- UI interactions and state management
- Agent routing and tenant isolation (`agent-routing.spec.ts`)

**Note:** Make sure the worker is running on `http://localhost:8787` before running E2E tests.

**Agent Routing Tests:**
```bash
cd widget
npx playwright test agent-routing.spec.ts  # Run agent routing tests
```

These tests verify that:
- Chats are correctly routed to different agents via `?agent=` query parameter
- Tenants (agents) have isolated data
- Default agent is used when no parameter is provided

### Running All Tests

From the root directory:
```bash
# Run worker tests
cd worker && npm test

# Run widget unit tests
cd widget && npm test

# Run widget E2E tests (requires worker running)
cd widget && npm run test:e2e
```

See [TESTING.md](./TESTING.md) for detailed testing guidelines and best practices.

## Architecture

See [PLAN.md](./PLAN.md) for detailed architecture and implementation plan.

## Documentation

- [Getting Started](./docs/getting-started.md)
- [API Reference](./docs/api-reference.md)
- [Tools & Agents](./docs/tools-agents.md)

## Deployment

This project is ready to deploy to Cloudflare Workers! See [docs/deployment.md](./docs/deployment.md) for detailed deployment instructions.

**Quick Deploy:**
```bash
cd worker
npm install
npx wrangler login
npx wrangler deploy
```

## Tech Stack

### Worker Backend
- **Runtime:** Cloudflare Workers
- **Framework:** Hono (routing & middleware)
- **AI:** Vercel AI SDK with OpenRouter
- **Language:** TypeScript
- **Testing:** Vitest

### Widget Frontend
- **Framework:** React 18 + Vite
- **State Management:** TanStack Query
- **UI Components:** shadcn/ui + Tailwind CSS
- **Language:** TypeScript
- **Testing:** Vitest + Playwright

## Contributing

See [docs/development.md](./docs/development.md) for development guidelines and best practices.

## License

MIT

