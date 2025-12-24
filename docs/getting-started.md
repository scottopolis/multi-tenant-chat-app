# Getting Started

This guide will help you set up and run the Multi-Tenant Chat Assistant locally.

## Prerequisites

- Node.js 18 or higher
- npm or pnpm
- OpenRouter API key (sign up at [openrouter.ai](https://openrouter.ai))

## Installation

### 1. Install Worker Dependencies

```bash
cd worker
npm install
```

### 2. Install Widget Dependencies

```bash
cd widget
npm install
```

## Configuration

### Worker Setup

1. **Set your OpenRouter API key:**

```bash
cd worker
npx wrangler secret put OPENROUTER_API_KEY
```

When prompted, paste your OpenRouter API key.

2. **Optional: Configure Langfuse (for future use)**

```bash
npx wrangler secret put LANGFUSE_SECRET_KEY
npx wrangler secret put LANGFUSE_PUBLIC_KEY
npx wrangler secret put LANGFUSE_HOST
```

### Widget Setup

Create a `.env` file in the `widget` directory:

```bash
cd widget
cp .env.example .env
```

The `.env` file should contain:

```
VITE_API_URL=http://localhost:8787
```

## Running Locally

### 1. Start the Worker (Backend)

In one terminal:

```bash
cd worker
npm run dev
```

The worker will start on `http://localhost:8787`

You should see output like:
```
⎔ Starting local server...
[wrangler:inf] Ready on http://localhost:8787
```

### 2. Start the Widget (Frontend)

In another terminal:

```bash
cd widget
npm run dev
```

The widget will start on `http://localhost:5173`

You should see:
```
  VITE v6.0.5  ready in XXX ms

  ➜  Local:   http://localhost:5173/
```

### 3. Open the App

Navigate to `http://localhost:5173` in your browser. You should see the chat interface!

## Testing the Integration

1. The app should automatically create a new chat when it loads
2. Type a message in the input field and press Enter
3. You should see your message appear immediately
4. The assistant's response should stream in real-time
5. Try asking about the current time or for a calculation to test the built-in tools

## Troubleshooting

### Worker won't start

- Make sure you've installed dependencies: `cd worker && npm install`
- Verify your OpenRouter API key is set correctly
- Check for port conflicts on 8787

### Widget won't connect to API

- Ensure the worker is running on `http://localhost:8787`
- Check the `.env` file has the correct `VITE_API_URL`
- Look for CORS errors in the browser console

### Messages aren't streaming

- Open browser DevTools and check the Network tab for SSE connections
- Look for errors in both the worker logs and browser console
- Verify your OpenRouter API key has available credits

## Next Steps

- [API Reference](./api-reference.md) - Learn about available endpoints
- [Tools & Agents](./tools-agents.md) - Customize the agent and add tools
- [Development](./development.md) - Development best practices

