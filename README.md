# Multi-Tenant Chat Assistant

A minimal chat assistant platform with a React widget frontend and Cloudflare Worker backend.

## Project Structure

```
chat-assistant/
├── worker/         # Cloudflare Worker API
├── widget/         # React chat widget
├── docs/           # Documentation
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm
- Cloudflare account (for deployment)
- OpenRouter API key

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
- 🚧 Authentication (placeholder)
- 🚧 Persistent storage (in-memory for now)
- 🚧 Langfuse integration (prepared)

## Architecture

See [PLAN.md](./PLAN.md) for detailed architecture and implementation plan.

## Documentation

- [Getting Started](./docs/getting-started.md)
- [API Reference](./docs/api-reference.md)
- [Tools & Agents](./docs/tools-agents.md)

## Deployment

See [docs/deployment.md](./docs/deployment.md) for deployment instructions.

