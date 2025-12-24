# Multi-Tenant Chat Assistant - Documentation

Welcome to the Multi-Tenant Chat Assistant documentation!

## Overview

This is a minimal chat assistant platform with a React widget frontend and Cloudflare Worker backend. The system uses OpenRouter for flexible AI model selection and is designed to be easily extended with custom tools and multi-tenant features.

## Documentation

- [Getting Started](./getting-started.md) - Installation and setup guide
- [API Reference](./api-reference.md) - Backend API endpoints and usage
- [Tools & Agents](./tools-agents.md) - How to work with tools and customize agents
- [Development](./development.md) - Development workflow and best practices
- [Deployment](./deployment.md) - Deploying to production

## Architecture

```
┌─────────────────────────────────────┐
│ Chat Widget (Vite + React + TS)     │
│  • TanStack Query for data fetching │
│  • shadcn/ui + Tailwind             │
└──────────────┬──────────────────────┘
               │ HTTPS + SSE streaming
               ▼
┌─────────────────────────────────────┐
│ Cloudflare Worker API               │
│  • Hono framework for routing       │
│  • AI SDK + OpenRouter              │
│  • In-memory storage (temporary)    │
└─────────────────────────────────────┘
```

## Quick Links

- [Project Structure](#project-structure)
- [Key Features](#key-features)
- [Roadmap](#roadmap)

## Project Structure

```
chat-assistant/
├── worker/         # Cloudflare Worker API
│   └── src/
│       ├── index.ts       # Main API routes
│       ├── storage.ts     # In-memory storage
│       ├── agents/        # Agent runner
│       └── tools/         # Tool registry
├── widget/         # React chat widget
│   └── src/
│       ├── components/    # UI components
│       ├── hooks/         # Custom hooks
│       └── lib/           # API client
└── docs/           # Documentation
```

## Key Features

- ✅ Real-time streaming chat using Server-Sent Events (SSE)
- ✅ OpenRouter integration for flexible model selection
- ✅ Tool/function calling support
- ✅ Modular tool system (built-in + webhook-based)
- ✅ Modern React UI with Tailwind CSS
- 🚧 Authentication (prepared but not implemented)
- 🚧 Persistent storage (currently in-memory)
- 🚧 Langfuse integration (prepared for future use)

## Roadmap

See [PLAN.md](../PLAN.md) for the complete implementation plan and future enhancements.

