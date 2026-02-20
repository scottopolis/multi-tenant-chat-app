# Multi-Tenant Chat Assistant - Documentation

A white-label AI chat platform that lets businesses embed customizable chat widgets on their websites. Each tenant can configure their own AI agents with custom system prompts, tools, and branding—all powered by a serverless Cloudflare Worker backend and Convex real-time database.

## Quick Start

This is an npm workspaces monorepo. From the root directory:

```bash
npm install        # Install all dependencies
npm run dev        # Start all services (convex, dashboard, mcp, widget, worker)
```

You can also run individual services:

```bash
npm run dev:widget      # Just the chat widget
npm run dev:dashboard   # Just the admin dashboard
npm run dev:worker      # Just the Cloudflare worker
npm run dev:convex      # Just the Convex backend
npm run dev:mcp         # Just the MCP server
```

---

Welcome to the Multi-Tenant Chat Assistant documentation!

## Overview

This is a minimal chat assistant platform with a React widget frontend and Cloudflare Worker backend. The system uses OpenRouter for flexible AI model selection and is designed to be easily extended with custom tools and multi-tenant features.

## Documentation

- [Getting Started](./getting-started.md) - Installation and setup guide
- [API Reference](./api-reference.md) - Backend API endpoints and usage
- [Tools & Agents](./tools-agents.md) - How to work with tools and customize agents
- [Widget](./widget.md) - How the embeddable chat widget works
- [Voice Agents](./voice-agents.md) - Set up phone-based AI agents with Twilio
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
│  • Tanstack AI SDK + OpenRouter              │
│  • Multi-tenant agent configs       │
└──────────────┬──────────────────────┘
               │ HTTP API
               ▼
┌─────────────────────────────────────┐
│ Convex Backend                      │
│  • Real-time database               │
│  • Agent & tenant configuration     │
│  • Vector search for RAG            │
└─────────────────────────────────────┘
```

### Convex Backend

The platform uses [Convex](https://convex.dev) as its backend database for storing tenant and agent configurations. Convex provides:

- **Real-time sync** - Changes to agent configs are instantly available
- **Type-safe queries** - Full TypeScript support with generated types
- **Vector search** - Built-in support for RAG embeddings
- **Zero infrastructure** - Fully managed, serverless database

The worker fetches agent configurations from Convex via HTTP API. Convex is the single source of truth for agent configs.

See the [Convex Guide](./convex.md) for setup and usage details.

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
- ✅ Convex backend for persistent storage
- 🚧 Auth enforcement not wired (see docs/authentication.md)
- 🚧 Langfuse integration (prepared for future use)

## Roadmap

See [PLAN.md](../PLAN.md) for the complete implementation plan and future enhancements.
