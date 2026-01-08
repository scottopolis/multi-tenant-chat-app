# Getting Started

This guide will help you set up and run the Multi-Tenant Chat Assistant locally.

## Prerequisites

- Node.js 18 or higher
- npm or pnpm
- OpenRouter API key (sign up at [openrouter.ai](https://openrouter.ai/keys))

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

1. **Set your OpenRouter API key for local development:**

Create a `.dev.vars` file in the `worker` directory:

```bash
cd worker
echo "OPENROUTER_API_KEY=your-api-key-here" > .dev.vars
```

Replace `your-api-key-here` with your actual OpenRouter API key from [openrouter.ai/keys](https://openrouter.ai/keys).

2. **For production deployment, use wrangler secrets:**

```bash
cd worker
npx wrangler secret put OPENROUTER_API_KEY
```

When prompted, paste your OpenRouter API key.

3. **Optional: Configure Langfuse (for future use)**

Add to `.dev.vars` for local development:
```bash
LANGFUSE_SECRET_KEY=your-secret-key
LANGFUSE_PUBLIC_KEY=your-public-key
LANGFUSE_HOST=https://us.cloud.langfuse.com
```

For production:
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
VITE_AGENT_ID=default
```

The `VITE_AGENT_ID` allows you to test different agent configurations.

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
- Verify your OpenAI API key is set correctly in `.dev.vars`
- Check that `.dev.vars` file exists in the worker directory
- Check for port conflicts on 8787

### Widget won't connect to API

- Ensure the worker is running on `http://localhost:8787`
- Check the `.env` file has the correct `VITE_API_URL`
- Look for CORS errors in the browser console

### Messages aren't streaming

- Open browser DevTools and check the Network tab for SSE connections
- Look for errors in both the worker logs and browser console
- Verify your OpenRouter API key is valid and has available credits
- Check the worker logs for any errors related to the OpenRouter API

## Next Steps

- [API Reference](./api-reference.md) - Learn about available endpoints
- [Tools & Agents](./tools-agents.md) - Customize the agent and add tools
- [Development](./development.md) - Development best practices



