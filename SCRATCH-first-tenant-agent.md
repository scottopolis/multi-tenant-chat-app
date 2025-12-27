# First Tenant Agent Implementation Plan

## Goal
Build the first real tenant agent with:
1. **Langfuse prompts** - System prompt fetched from Langfuse
2. **MCP server** - Tools from a Model Context Protocol server

> **Note**: Webhook tools deferred to later phase. MCP is the primary tool integration method.

## Current State

### What Exists
- `runAgent()` in `worker/src/agents/index.ts` - basic agent runner
- `builtinTools` in `worker/src/tools/builtin.ts` - currentTime, calculator
- `createWebhookTool()` in `worker/src/tools/webhook.ts` - webhook tool factory
- `getTools()` in `worker/src/tools/index.ts` - returns all builtins (no org filtering)
- Auth middleware that hardcodes `orgId: 'default'`

### What's Missing
- Langfuse client integration
- Per-tenant configuration storage/fetching
- MCP client for connecting to external tool servers
- Tenant-specific tool selection
- **Agent/tenant routing mechanism**

---

## Phase 0: Agent Routing (Pre-requisite)

### Goal
Determine which agent to run based on the incoming request. For MVP, use a URL query parameter. Later, this will come from JWT token claims.

### Routing Strategy

| Stage | How Tenant is Identified | Example |
|-------|--------------------------|---------|
| **MVP** | Query param `?agent=tenant-1` | `POST /api/chats?agent=tenant-1` |
| **Auth Phase** | JWT claim `tenantId` or `orgId` | Bearer token contains tenant info |
| **Production** | API Key lookup | Key maps to tenant in database |

### Implementation

#### 0.1 Update auth middleware to extract agent from query param

```typescript
// worker/src/index.ts

app.use('*', async (c, next) => {
  // MVP: Get agent/tenant from query param
  const agentId = c.req.query('agent') || 'default';
  
  // TODO: When auth is implemented, extract from JWT:
  // const token = c.req.header('Authorization')?.replace('Bearer ', '');
  // const payload = await verifyJWT(token);
  // const agentId = payload.tenantId || payload.orgId;
  
  c.set('orgId', agentId);
  c.set('userId', 'anonymous');
  await next();
});
```

#### 0.2 Widget passes agent param

Update widget API client to include agent parameter:

```typescript
// widget/src/lib/api.ts

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';
const AGENT_ID = import.meta.env.VITE_AGENT_ID || 'default';

export async function createChat(title?: string): Promise<Chat> {
  const response = await fetch(`${API_URL}/api/chats?agent=${AGENT_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  return response.json();
}
```

#### 0.3 Test different agents

```bash
# Create chat with default agent
curl -X POST "http://localhost:8787/api/chats?agent=default"

# Create chat with tenant-1 agent  
curl -X POST "http://localhost:8787/api/chats?agent=tenant-1"

# Send message to tenant-1's chat
curl -X POST "http://localhost:8787/api/chats/abc123/messages?agent=tenant-1" \
  -H "Content-Type: application/json" \
  -d '{"content": "What is my order status?"}'
```

### Agent ID Conventions

- `default` - Fallback agent with basic tools and generic prompt
- `tenant-1`, `tenant-2`, etc. - Tenant-specific agents (MVP naming)
- Later: Use UUIDs or slugs like `acme-support`, `contoso-sales`

### Future: Subdomain-based routing

For production, could also support subdomain routing:
- `acme.chat.example.com` → agent=acme
- `contoso.chat.example.com` → agent=contoso

```typescript
app.use('*', async (c, next) => {
  const host = c.req.header('host') || '';
  const subdomain = host.split('.')[0];
  const agentId = subdomain !== 'chat' ? subdomain : c.req.query('agent') || 'default';
  c.set('orgId', agentId);
  await next();
});
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Tenant Configuration                         │
│  (stored in: hardcoded for MVP → database later)                 │
│                                                                   │
│  - System prompt (optional, fallback if no Langfuse)             │
│  - Langfuse config (optional, for dynamic prompts)               │
│  - MCP server endpoint (URL, auth, transport)                     │
│  - Model selection                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       runAgent()                                  │
│                                                                   │
│  1. Get tenant config (by agent ID from ?agent= param)           │
│  2. Determine system prompt:                                      │
│     Priority: Langfuse → tenant.systemPrompt → default           │
│  3. Get tools:                                                    │
│     - Built-in tools (currentTime, calculator)                   │
│     - MCP tools (from connected MCP server)                      │
│  4. Call streamText with prompt + tools                          │
│  5. Return streaming response                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      MCP Server (External)                        │
│                                                                   │
│  Tenant's own server that exposes tools via MCP protocol         │
│  - HTTP transport (recommended)                                   │
│  - Tools: lookupOrder, searchKnowledgeBase, etc.                 │
│  - Managed by tenant, not by this platform                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Langfuse Prompt Integration (Optional)

### Goal
Make Langfuse integration optional. Tenants can choose:
1. **Langfuse** - Dynamic prompts managed in Langfuse (most flexible)
2. **systemPrompt** - Static prompt in tenant config (simpler)
3. **Default** - Fall back to platform default prompt

**Priority**: Langfuse → tenant.systemPrompt → DEFAULT_SYSTEM_PROMPT

### Implementation

#### 1.1 Install Langfuse SDK
```bash
cd worker
npm install langfuse
```

#### 1.2 Create Langfuse client module
Create `worker/src/langfuse/index.ts`:

```typescript
import { Langfuse } from 'langfuse';

let langfuseClient: Langfuse | null = null;

export function getLangfuseClient(env: {
  LANGFUSE_PUBLIC_KEY: string;
  LANGFUSE_SECRET_KEY: string;
  LANGFUSE_HOST?: string;
}): Langfuse {
  if (!langfuseClient) {
    langfuseClient = new Langfuse({
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      secretKey: env.LANGFUSE_SECRET_KEY,
      baseUrl: env.LANGFUSE_HOST || 'https://cloud.langfuse.com',
    });
  }
  return langfuseClient;
}

export async function getPromptByTenant(
  langfuse: Langfuse,
  tenantId: string,
  promptName: string = 'base-assistant'
): Promise<string> {
  try {
    // Use tenant ID as the label to get tenant-specific prompt version
    const prompt = await langfuse.getPrompt(promptName, undefined, {
      label: tenantId,
    });
    return prompt.prompt as string;
  } catch (error) {
    console.error(`Failed to fetch prompt for tenant ${tenantId}:`, error);
    // Fallback to default prompt
    return 'You are a helpful AI assistant.';
  }
}
```

#### 1.3 Update runAgent to use Langfuse
Modify `worker/src/agents/index.ts`:

```typescript
import { getLangfuseClient, getPromptByTenant } from '../langfuse';

export interface RunAgentOptions {
  messages: Array<{ role: string; content: string }>;
  apiKey: string;
  orgId: string;
  model?: string;
  env: {
    LANGFUSE_PUBLIC_KEY: string;
    LANGFUSE_SECRET_KEY: string;
    LANGFUSE_HOST?: string;
  };
}

export async function runAgent(options: RunAgentOptions) {
  const { messages, apiKey, orgId, model = DEFAULT_MODEL, env } = options;

  // Fetch prompt from Langfuse
  const langfuse = getLangfuseClient(env);
  const systemPrompt = await getPromptByTenant(langfuse, orgId);
  
  // ... rest of implementation
}
```

### Langfuse Setup Requirements
1. Create a Langfuse account at https://cloud.langfuse.com
2. Create a project
3. Create a prompt named "base-assistant" with:
   - Default version (production)
   - Tenant-specific versions with labels matching tenant IDs

### Environment Variables Required
```
LANGFUSE_PUBLIC_KEY=pk-lf-xxx
LANGFUSE_SECRET_KEY=sk-lf-xxx
LANGFUSE_HOST=https://cloud.langfuse.com  # optional, defaults to cloud
```

---

---

## Phase 2: MCP Server Integration

### What is MCP?
Model Context Protocol (MCP) is Anthropic's open standard for connecting AI assistants to external tools, data sources, and services. It uses a client-server architecture where:
- **MCP Server**: Exposes tools, resources, and prompts
- **MCP Client**: Connects to servers and makes tools available to the LLM

### MCP Transport Options
1. **stdio** - For local processes (not suitable for Workers)
2. **HTTP** - Recommended for remote servers ✅
3. **SSE** - Alternative HTTP-based transport

### Implementation (Using AI SDK's MCP Package)

The Vercel AI SDK has a dedicated `@ai-sdk/mcp` package that handles MCP integration cleanly. Tools from MCP are automatically converted to AI SDK format!

#### 2.1 Install AI SDK MCP package
```bash
cd worker
npm install @ai-sdk/mcp
```

#### 2.2 Create MCP client wrapper
Create `worker/src/mcp/client.ts`:

```typescript
import { createMCPClient } from '@ai-sdk/mcp';
import type { experimental_Tool } from 'ai';

export interface MCPClientConfig {
  serverUrl: string;
  authHeader?: string;
}

/**
 * Create an MCP client and fetch its tools
 * 
 * Uses HTTP transport (recommended for production)
 * Tools are automatically converted to AI SDK format
 */
export async function createTenantMCPClient(config: MCPClientConfig) {
  const mcpClient = await createMCPClient({
    transport: {
      type: 'http',
      url: config.serverUrl,
      headers: config.authHeader 
        ? { Authorization: config.authHeader }
        : undefined,
    },
  });

  return mcpClient;
}

/**
 * Get tools from an MCP server
 * Returns tools in AI SDK format, ready to use with streamText
 */
export async function getMCPTools(config: MCPClientConfig): Promise<Record<string, experimental_Tool>> {
  try {
    const client = await createTenantMCPClient(config);
    // The MCP client's tools property returns AI SDK compatible tools
    return client.tools();
  } catch (error) {
    console.error('Failed to connect to MCP server:', error);
    return {};
  }
}

/**
 * Close MCP client connection
 * Call this when done to clean up resources
 */
export async function closeMCPClient(client: Awaited<ReturnType<typeof createMCPClient>>) {
  try {
    await client.close();
  } catch (error) {
    console.error('Error closing MCP client:', error);
  }
}
```

#### 2.3 Alternative: SSE Transport
If your MCP server uses SSE instead of HTTP:

```typescript
const mcpClient = await createMCPClient({
  transport: {
    type: 'sse',
    url: config.serverUrl,
    headers: config.authHeader 
      ? { Authorization: config.authHeader }
      : undefined,
  },
});
```

#### 2.4 Update tenant config to include MCP server
Update `worker/src/tenants/types.ts`:

```typescript
export interface TenantConfig {
  tenantId: string;
  langfusePromptName?: string;
  model?: string;
  
  // MCP Server configuration
  mcpServer?: {
    url: string;
    authHeader?: string;
    transport?: 'http' | 'sse';  // default: 'http'
  };
}
```

#### 2.5 Update getTools to include MCP tools
Update `worker/src/tools/index.ts`:

```typescript
import { builtinTools } from './builtin';
import { getMCPTools } from '../mcp/client';
import { getTenantConfig } from '../tenants/config';

/**
 * Get all available tools for a tenant
 * Merges: built-in tools + MCP server tools
 */
export async function getTools(tenantId: string) {
  const config = await getTenantConfig(tenantId);
  
  // Start with built-in tools
  const tools: Record<string, any> = { ...builtinTools };
  
  // Add MCP tools if configured
  if (config?.mcpServer?.url) {
    const mcpTools = await getMCPTools({
      serverUrl: config.mcpServer.url,
      authHeader: config.mcpServer.authHeader,
    });
    Object.assign(tools, mcpTools);
  }
  
  return tools;
}
```

#### 2.6 Update runAgent to use async getTools
Since `getTools` is now async, update the agent runner:

```typescript
// worker/src/agents/index.ts

export async function runAgent(options: RunAgentOptions) {
  const { messages, apiKey, orgId, env } = options;

  // ... fetch prompt from Langfuse ...

  // Get tools (now async due to MCP)
  const tools = await getTools(orgId);

  // Stream the response
  const result = streamText({
    model: openrouter.chat(modelId),
    messages: messagesWithSystem,
    tools,
    maxSteps: 5,
  });

  return result;
}
```

### MCP Server Lifecycle in Cloudflare Workers

**Important**: Cloudflare Workers are stateless. Each request creates a new execution context.

**Options:**
1. **Connect per request** (simple, slightly slower) - Create MCP client, get tools, use, close
2. **Use Durable Objects** (complex, persistent connections) - For production scale
3. **Cache tool definitions** (hybrid) - Cache MCP tool schemas, reconnect only when needed

For MVP, we'll use option 1 (connect per request):

```typescript
export async function runAgent(options: RunAgentOptions) {
  const config = await getTenantConfig(options.orgId);
  let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | null = null;
  
  try {
    // Get tools (creates MCP connection)
    const tools = await getTools(options.orgId);
    
    // Run the agent
    const result = streamText({ /* ... */ tools });
    
    return result;
  } finally {
    // Clean up MCP connection after streaming completes
    // Note: This is tricky with streaming - may need to handle in stream consumer
  }
}
```

### Testing MCP Integration

#### Test with a local MCP server
Use the official MCP examples:

```bash
# Clone MCP examples
git clone https://github.com/modelcontextprotocol/servers.git mcp-servers

# Run the filesystem server (example)
cd mcp-servers/src/filesystem
npm install
npm start -- --port 3001
```

#### Test tool discovery
```typescript
const tools = await getMCPTools({
  serverUrl: 'http://localhost:3001/mcp',
});
console.log('Available MCP tools:', Object.keys(tools));
```

---

## Phase 3: Putting It All Together

### Updated Agent Runner Flow

```typescript
// worker/src/agents/index.ts

import { streamText, type CoreMessage } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { getTools } from '../tools';
import { getTenantConfig } from '../tenants/config';
import { getLangfuseClient, getPromptByTenant } from '../langfuse';

export async function runAgent(options: RunAgentOptions) {
  const { messages, apiKey, orgId, env } = options;

  // 1. Get tenant config
  const tenantConfig = await getTenantConfig(orgId);
  
  // 2. Determine system prompt (priority: Langfuse → tenant.systemPrompt → default)
  let systemPrompt: string | undefined;
  
  // Try Langfuse first (if configured for tenant or platform)
  if (tenantConfig.langfuse || (env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY)) {
    const langfuseCredentials = tenantConfig.langfuse || {
      publicKey: env.LANGFUSE_PUBLIC_KEY!,
      secretKey: env.LANGFUSE_SECRET_KEY!,
      host: env.LANGFUSE_HOST,
    };
    
    try {
      const langfuse = getLangfuseClient(langfuseCredentials);
      systemPrompt = await getPromptByTenant(
        langfuse, 
        orgId, 
        langfuseCredentials.promptName || 'base-assistant'
      );
    } catch (error) {
      console.error('Failed to fetch Langfuse prompt:', error);
    }
  }
  
  // Fallback to tenant's systemPrompt
  if (!systemPrompt && tenantConfig.systemPrompt) {
    systemPrompt = tenantConfig.systemPrompt;
  }
  
  // Final fallback to default
  if (!systemPrompt) {
    systemPrompt = DEFAULT_SYSTEM_PROMPT;
  }
  
  // 3. Get model (from config or default)
  const model = tenantConfig?.model || DEFAULT_MODEL;
  const modelId = AVAILABLE_MODELS[model as ModelName] || model;

  // 4. Get tools (builtins + MCP)
  const tools = await getTools(orgId);

  // 5. Create provider and stream
  const openrouter = createOpenRouter({ apiKey });
  
  const messagesWithSystem: CoreMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content }) as CoreMessage),
  ];

  const result = streamText({
    model: openrouter.chat(modelId) as any,
    messages: messagesWithSystem,
    tools,
    maxSteps: 5,
  });

  return result;
}
```

### Tenant Config Structure

```typescript
// worker/src/tenants/types.ts

export interface TenantConfig {
  tenantId: string;
  
  // System prompt (optional, used if Langfuse not configured)
  systemPrompt?: string;
  
  // Langfuse prompt configuration (optional)
  langfuse?: {
    publicKey: string;
    secretKey: string;
    host?: string;
    promptName?: string;  // defaults to 'base-assistant'
    label?: string;
  };
  
  // Model configuration
  model?: string;  // defaults to 'gpt-4.1-mini'
  
  // MCP Server configuration
  mcpServer?: {
    url: string;
    authHeader?: string;
    transport?: 'http' | 'sse';
  };
  
  // TODO: Future additions
  // webhookTools?: WebhookToolConfig[];
  // enabledBuiltinTools?: string[];
  // rateLimits?: RateLimitConfig;
}
```

### Hardcoded First Tenant Config (MVP)

```typescript
// worker/src/tenants/config.ts

import type { TenantConfig } from './types';

// MVP: Hardcode first tenant config
// TODO: Fetch from database (D1/Convex/etc.)
const TENANT_CONFIGS: Record<string, TenantConfig> = {
  'default': {
    tenantId: 'default',
    systemPrompt: 'You are a helpful AI assistant.',
    model: 'gpt-4.1-mini',
    // No MCP server for default tenant
  },
  'tenant-1': {
    tenantId: 'tenant-1',
    // Option 1: Use Langfuse for dynamic prompt management
    langfuse: {
      publicKey: 'pk-lf-xxx',
      secretKey: 'sk-lf-xxx',
      promptName: 'support-agent',
    },
    model: 'gpt-4.1-mini',
    mcpServer: {
      url: 'https://mcp.example.com/tenant-1',
      authHeader: 'Bearer tenant-1-mcp-key',
      transport: 'http',
    },
  },
  'tenant-2': {
    tenantId: 'tenant-2',
    // Option 2: Use hardcoded systemPrompt (simpler, no Langfuse needed)
    systemPrompt: `You are a sales assistant for Acme Corp. 
    
Help customers find products and answer questions about our offerings.
Be friendly, professional, and always try to upsell related items.`,
    model: 'gpt-4.1-mini',
  },
};

export async function getTenantConfig(tenantId: string): Promise<TenantConfig> {
  // Return tenant config or fall back to default
  return TENANT_CONFIGS[tenantId] || TENANT_CONFIGS['default'];
}
```

---

## Implementation Order

### Step 1: Agent Routing (Phase 0) - ~30 min
- [ ] Update auth middleware to read `?agent=` query param
- [ ] Test that different agent IDs flow through to `runAgent()`

### Step 2: Tenant Config (Phase 0.5) - ~1 hour
- [ ] Create `worker/src/tenants/types.ts` with TenantConfig interface
- [ ] Create `worker/src/tenants/config.ts` with hardcoded configs
- [ ] Add `getTenantConfig()` function

### Step 3: MCP Integration (Phase 2) - ~2 hours
- [ ] Install `@ai-sdk/mcp` package
- [ ] Create `worker/src/mcp/client.ts` with HTTP transport
- [ ] Update `worker/src/tools/index.ts` to merge MCP tools
- [ ] Make `getTools()` async
- [ ] Update `runAgent()` to await `getTools()`
- [ ] Test with a local or remote MCP server

### Step 4: Langfuse Integration (Phase 1) - ~1 hour
- [ ] Install `langfuse` package
- [ ] Create `worker/src/langfuse/index.ts`
- [ ] Update `runAgent()` to fetch prompt from Langfuse
- [ ] Add environment variables to `.dev.vars`
- [ ] Create test prompt in Langfuse dashboard
- [ ] Test with tenant-specific prompts

### Step 5: End-to-End Testing - ~1 hour
- [ ] Test full flow: agent param → tenant config → MCP tools → Langfuse prompt
- [ ] Verify tool calling works with MCP server
- [ ] Test fallbacks (no MCP server, no Langfuse)

---

## Deferred (Future Phases)

### Webhook Tools
- [ ] Create `worker/src/utils/schema-converter.ts` for JSON Schema → Zod
- [ ] Update `getTools()` to load webhook tools from tenant config
- [ ] Add `webhookTools` to TenantConfig

### Database Storage
- [ ] Move tenant configs from hardcoded to D1/Convex
- [ ] Add admin API for tenant management
- [ ] Add caching with TTL

---

## Future TODOs (Not in MVP)

### Tenant Configuration Storage
- [ ] Move from hardcoded config to D1/Convex database
- [ ] Create admin API for tenant management
- [ ] Add tenant config caching with TTL

### Langfuse Tracing
- [ ] Enable `experimental_telemetry` in streamText
- [ ] Track tool usage, tokens, latency
- [ ] Create Langfuse dashboard for monitoring

### MCP Improvements
- [ ] Connection pooling (use Durable Objects for persistent connections)
- [ ] Health checks and reconnection logic
- [ ] Support for MCP resources (not just tools)
- [ ] MCP server authentication with OAuth

### Webhook Tools (Deferred)
- [ ] Implement JSON Schema → Zod converter
- [ ] Add webhook signature verification (HMAC)
- [ ] Timeout and retry logic
- [ ] Response validation

### Security
- [ ] Tool input/output sanitization
- [ ] Rate limiting per tenant
- [ ] Audit logging for tool calls
- [ ] Per-tenant CORS restrictions

### Tool Management UI
- [ ] Admin dashboard for tool configuration
- [ ] Tool testing interface
- [ ] Usage analytics per tool

---

## Test First Tenant Agent

### Example Tenant: Customer Support Bot

**Langfuse Prompt ("support-agent"):**
```
You are a customer support agent for Acme Corp. You help customers with order inquiries and product questions.

When customers ask about orders, use the available tools to look up information.

Be helpful, professional, and concise. If you can't resolve an issue, offer to escalate to a human agent.
```

**MCP Server Tools** (exposed by tenant's MCP server):
- `lookupOrder` - Look up order details by order ID
- `searchKnowledgeBase` - Search FAQ/docs
- `createTicket` - Create support ticket
- `getCustomerHistory` - Fetch customer interaction history

### Test Conversations

1. **Order inquiry:**
   > User: "What's the status of order #12345?"
   > Agent: *calls lookupOrder via MCP* → "Your order is shipped and arriving Tuesday..."

2. **Product question:**
   > User: "How do I reset my device?"
   > Agent: *calls searchKnowledgeBase via MCP* → "Here's how to reset..."

3. **Escalation:**
   > User: "I want to speak to a manager"
   > Agent: *calls createTicket via MCP* → "I've created ticket #789, someone will reach out..."

4. **Time inquiry (built-in tool):**
   > User: "What time is it?"
   > Agent: *calls currentTime (built-in)* → "It's currently 3:45 PM UTC..."

---

## Quick Start Commands

```bash
# 1. Install dependencies
cd worker
npm install @ai-sdk/mcp langfuse

# 2. Add env vars to .dev.vars
echo "LANGFUSE_PUBLIC_KEY=pk-lf-xxx" >> .dev.vars
echo "LANGFUSE_SECRET_KEY=sk-lf-xxx" >> .dev.vars

# 3. Start worker
npm run dev

# 4. Test with default agent
curl -X POST "http://localhost:8787/api/chats?agent=default" \
  -H "Content-Type: application/json"

# 5. Test with tenant-1 agent (will use MCP if configured)
curl -X POST "http://localhost:8787/api/chats?agent=tenant-1" \
  -H "Content-Type: application/json"

# 6. Send message to a chat
curl -X POST "http://localhost:8787/api/chats/{chatId}/messages?agent=tenant-1" \
  -H "Content-Type: application/json" \
  -d '{"content": "What time is it?"}'
```

---

## Questions to Resolve

1. **MCP Transport Choice**: HTTP transport is recommended for production. SSE is an alternative. Test which works better with Cloudflare Workers.

2. **Connection Lifecycle**: AI SDK's `createMCPClient` creates a connection. In serverless:
   - Connect per request (simple, some latency)
   - Use Durable Objects for persistent connections (complex, lower latency)
   - **MVP approach**: Connect per request, optimize later

3. **Tool Caching**: MCP tool definitions could change. Options:
   - No caching (always fetch fresh) - safest, slightly slower
   - Cache with short TTL (5 min) - good balance
   - Cache until explicit invalidation - requires webhook from MCP server

4. **Error Handling**: When MCP server is down:
   - Log error, continue with just built-in tools ✅
   - Don't fail the entire request
   - Consider alerting for production

5. **Which MCP server to test with?** Options:
   - Official MCP example servers (filesystem, git, etc.)
   - Build a simple custom MCP server
   - Use a hosted MCP service if available

---

*Last Updated: December 27, 2024*

