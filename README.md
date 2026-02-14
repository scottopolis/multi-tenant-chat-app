# Multi-Tenant Chat Assistant

A minimal chat assistant platform with a React widget frontend and Cloudflare Worker backend. Built with TanStack AI and OpenRouter for provider-agnostic model access (Claude, GPT, Gemini, Llama), featuring real-time streaming, tool calling, and a modern React UI.

**Repository:** https://github.com/scottopolis/multi-tenant-chat-app

## Project Structure

```
multi-tenant-chat-app/
├── convex-backend/ # Convex backend (database, functions)
├── dashboard/      # Dashboard UI
├── mcp/            # MCP server
├── widget/         # React chat widget (Vite + TanStack Query + shadcn/ui)
├── worker/         # Cloudflare Worker API (Hono + OpenAI Agents SDK)
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
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

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

Worker (create `worker/.dev.vars` for local development):
```bash
cd worker
echo "OPENROUTER_API_KEY=your-api-key-here" > .dev.vars
```

For production deployment, use wrangler secrets:
```bash
npx wrangler secret put OPENROUTER_API_KEY
```

Get your OpenRouter API key at [openrouter.ai/keys](https://openrouter.ai/keys)

Widget (create `.env`):
```
VITE_API_URL=http://localhost:8787
VITE_AGENT_ID=default
```

## Features

- ✅ Real-time streaming chat with SSE
- ✅ TanStack AI + OpenRouter integration
  - Provider-agnostic: Claude, GPT, Gemini, Llama via OpenRouter
  - Native tool/function calling support
  - Built-in agent loop strategies
  - Structured output support
- ✅ Multiple AI models (gpt-4.1-mini, claude-sonnet-4, gemini-2.0-flash, llama-4-scout)
- ✅ Agent routing via query parameters (MVP multi-tenancy)
- ✅ MCP (Model Context Protocol) server integration via HTTP
- ✅ Embeddable widget with customizable launcher
- ✅ Voice agents via Twilio + Deepgram STT/TTS
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

## Widget Embedding

The chat widget can be embedded on any website using a simple script tag:

```html
<script
  src="https://multi-tenant-chat-app.pages.dev/embed.js"
  data-agent-id="YOUR_AGENT_ID"
  data-color="#4F46E5"
  data-position="bottom-right"
  data-icon="chat"
  defer
></script>
```

**Configuration Options:**

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-agent-id` | required | Your agent identifier |
| `data-color` | `#4F46E5` | Launcher button color (hex) |
| `data-position` | `bottom-right` | `bottom-right` or `bottom-left` |
| `data-icon` | `chat` | `chat`, `help`, or `message` |

**Auto-Open:** Add `?chat=open` to any URL to automatically open the widget on page load.

**Security:** The widget uses API key authentication with domain allowlists. Keys are validated at the edge via Cloudflare Worker, and only configured domains can embed your widget.

See [docs/widget.md](./docs/widget.md) for architecture and security details, or [specs/widget-embed-hosting.md](./specs/widget-embed-hosting.md) for embed configuration.

## Voice Agents

Voice agents allow users to interact with your AI assistant via phone calls using Twilio and Deepgram STT/TTS, with any LLM for reasoning.

**Quick Setup:**

1. Create an agent in the Dashboard with **Voice** capability enabled
2. Configure a Twilio phone number with webhook: `https://multi-tenant-chat-app.designbyscott.workers.dev/twilio/voice`
3. Add the phone number in the Dashboard under the agent's Voice tab
4. Call the number to test

**Voice Settings:**

| Setting | Options |
|---------|---------|
| STT Model | Deepgram STT model (e.g., `nova-3`) |
| TTS Model | Deepgram TTS model (e.g., `aura-2-*`) |
| TTS Voice | Optional Deepgram voice override |
| Locale | en-US, en-GB, es-ES, fr-FR, de-DE, and more |
| Barge-in | Allow callers to interrupt the AI |

**Web Preview:** Test voice agents directly in the browser without a phone number via the Dashboard's Voice Preview feature.

See [docs/voice-agents.md](./docs/voice-agents.md) for complete setup and configuration guide, and [docs/deepgram-voice.md](./docs/deepgram-voice.md) for Deepgram-specific details.

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
- **Runtime:** Cloudflare Workers (with `nodejs_compat` flag)
- **Framework:** Hono (routing & middleware)
- **AI:** TanStack AI (`@tanstack/ai`) + OpenRouter
- **Language:** TypeScript (strict mode)
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
