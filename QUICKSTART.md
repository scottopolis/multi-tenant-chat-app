# Quick Start Guide

Get up and running in 5 minutes!

## ✅ What's Been Built

Your multi-tenant chat assistant is ready to go with:

### Backend (Cloudflare Worker)
- ✅ Hono API with SSE streaming
- ✅ OpenRouter integration (supports multiple models)
- ✅ In-memory storage for chats and messages
- ✅ Tool/function calling system
- ✅ Built-in tools (current time, calculator)
- ✅ Webhook tool support for custom integrations
- ✅ CORS and placeholder auth middleware

### Frontend (React Widget)
- ✅ Modern React UI with Tailwind CSS
- ✅ Real-time streaming chat interface
- ✅ TanStack Query for data management
- ✅ Custom useChat hook for state management
- ✅ Beautiful shadcn/ui components
- ✅ Auto-scrolling message list
- ✅ Loading and error states

### Documentation
- ✅ Complete API reference
- ✅ Tools & agents guide
- ✅ Development guide
- ✅ Deployment guide

## 🚀 Installation & Setup

### Step 1: Install Worker Dependencies

```bash
cd worker
npm install
```

### Step 2: Configure OpenRouter API Key

You have two options:

**Option A: Use `.dev.vars` file (Recommended for local dev)**

Create `worker/.dev.vars`:
```bash
OPENROUTER_API_KEY=your_key_here
```

**Option B: Use wrangler secret**

```bash
cd worker
npx wrangler secret put OPENROUTER_API_KEY
# Paste your key when prompted
```

> Get your API key at [openrouter.ai](https://openrouter.ai)

### Step 3: Start the Worker

```bash
cd worker
npm run dev
```

You should see:
```
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

### Step 4: Install Widget Dependencies

In a new terminal:

```bash
cd widget
npm install
```

### Step 5: Configure Widget Environment

Create `widget/.env`:

```bash
VITE_API_URL=http://localhost:8787
```

### Step 6: Start the Widget

```bash
cd widget
npm run dev
```

You should see:
```
➜  Local:   http://localhost:5173/
```

### Step 7: Open and Test

1. Open http://localhost:5173 in your browser
2. The app will auto-create a new chat
3. Type a message and press Enter
4. Watch the AI response stream in real-time!

## 🧪 Test the Tools

Try these messages to test the built-in tools:

- **"What time is it?"** - Tests the currentTime tool
- **"What's 127 times 43?"** - Tests the calculator tool
- **"What time is it in Tokyo?"** - Tests timezone parameter

## 📁 Project Structure

```
multi-tenant-chat-assistant/
├── worker/              # Cloudflare Worker API
│   ├── src/
│   │   ├── index.ts    # Main API routes
│   │   ├── storage.ts  # Data storage
│   │   ├── agents/     # Agent logic
│   │   └── tools/      # Tool system
│   └── package.json
├── widget/              # React frontend
│   ├── src/
│   │   ├── App.tsx     # Root component
│   │   ├── components/ # UI components
│   │   ├── hooks/      # Custom hooks
│   │   └── lib/        # API client
│   └── package.json
└── docs/                # Full documentation
```

## 🎯 Key Features Implemented

1. **Streaming Responses** - Real-time SSE streaming for fast UX
2. **Multiple Models** - Support for GPT-4, Claude, Llama, and more via OpenRouter
3. **Tool Calling** - AI can use tools to extend capabilities
4. **Modular Architecture** - Easy to extend with new features
5. **Type Safety** - Full TypeScript throughout
6. **Modern UI** - Beautiful, responsive interface

## 🔧 Customization

### Change the Default Model

Edit `worker/src/agents/index.ts`:

```typescript
const DEFAULT_MODEL: ModelName = 'claude-3.5-sonnet'; // or any other model
```

### Customize System Prompt

Edit `worker/src/agents/index.ts`:

```typescript
const DEFAULT_SYSTEM_PROMPT = `Your custom prompt here...`;
```

### Add a New Tool

See `docs/tools-agents.md` for detailed instructions.

## 📚 Next Steps

- **[Getting Started Guide](docs/getting-started.md)** - Detailed setup
- **[API Reference](docs/api-reference.md)** - API documentation
- **[Tools & Agents](docs/tools-agents.md)** - Customize the agent
- **[Development Guide](docs/development.md)** - Best practices
- **[Deployment Guide](docs/deployment.md)** - Go to production

## 🐛 Troubleshooting

**Worker won't start:**
- Verify `npm install` completed successfully
- Check that your OpenRouter API key is set correctly

**Widget can't connect:**
- Ensure worker is running on http://localhost:8787
- Check that `widget/.env` has correct API URL
- Look for CORS errors in browser console

**No streaming response:**
- Verify your OpenRouter API key has credits
- Check browser DevTools → Network tab for SSE connection
- Look for errors in worker terminal

## 🎉 Success Criteria

Your implementation is complete when:
- ✅ Both worker and widget start without errors
- ✅ Chat interface loads in the browser
- ✅ You can send messages and receive streaming responses
- ✅ Built-in tools work (time and calculator)
- ✅ Messages persist during the session

## 💡 What's Next?

The following features are prepared with TODO comments for when you're ready:

- **Authentication** - JWT validation placeholders
- **Database** - Replace in-memory storage with D1/Convex/Turso
- **Langfuse** - Prompt management and tracing
- **Webhook Tools** - Custom tool integrations
- **Multi-tenancy** - Per-org configuration
- **SaaS Dashboard** - Management interface

All these features have clear TODO comments in the code showing where to add them!

