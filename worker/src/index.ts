import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { createChat, getChat, listChats, addMessage, getMessages } from './storage';
import { runAgent, isValidModel } from './agents/index';
import { z } from 'zod';

/**
 * Cloudflare Worker environment bindings
 */
type Bindings = {
  OPENROUTER_API_KEY: string;
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_HOST?: string;
};

type Variables = {
  orgId: string;
  userId?: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * CORS Middleware
 * 
 * TODO: Restrict origins per org
 * - Fetch allowed origins from org settings
 * - Validate origin against org's allowed domains
 * - Support wildcard subdomains (e.g., *.example.com)
 */
app.use('*', cors({
  origin: '*', // Allow all origins for now
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

/**
 * Auth Middleware (Placeholder)
 * 
 * MVP: Extract agent/tenant ID from query parameter ?agent=tenant-1
 * 
 * TODO: Auth middleware for production
 * - Verify JWT from Authorization header
 * - Extract orgId/tenantId from JWT payload
 * - Reject requests with invalid/expired tokens
 * - Support API key authentication as alternative
 * 
 * Example JWT validation:
 *   const token = c.req.header('Authorization')?.replace('Bearer ', '');
 *   if (!token) {
 *     return c.json({ error: 'Unauthorized' }, 401);
 *   }
 *   try {
 *     const payload = await verifyJWT(token);
 *     c.set('orgId', payload.tenantId || payload.orgId);
 *     c.set('userId', payload.userId);
 *   } catch (error) {
 *     return c.json({ error: 'Invalid token' }, 401);
 *   }
 */
app.use('*', async (c, next) => {
  // MVP: Get agent/tenant from query param
  const agentParam = c.req.query('agent');
  const agentId = agentParam && agentParam.trim() !== '' ? agentParam : 'default';
  
  // Set orgId to the agent ID (used throughout the app to identify the tenant)
  c.set('orgId', agentId);
  c.set('userId', 'anonymous');
  await next();
});

/**
 * Health check endpoint
 */
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /api/chats
 * Create a new chat
 */
app.post('/api/chats', async (c) => {
  try {
    const orgId = c.get('orgId');
    const body = await c.req.json().catch(() => ({}));
    const title = body.title;

    const chat = createChat(orgId, title);
    
    return c.json(chat, 201);
  } catch (error) {
    console.error('Error creating chat:', error);
    return c.json({ error: 'Failed to create chat' }, 500);
  }
});

/**
 * GET /api/chats
 * List all chats for the current org
 */
app.get('/api/chats', async (c) => {
  try {
    const orgId = c.get('orgId');
    const chats = listChats(orgId);
    
    return c.json({ chats });
  } catch (error) {
    console.error('Error listing chats:', error);
    return c.json({ error: 'Failed to list chats' }, 500);
  }
});

/**
 * GET /api/chats/:chatId
 * Get a single chat with its messages
 * 
 * TODO: Verify org ownership
 * - Check that the chat belongs to the requesting org
 * - Return 403 if org doesn't match
 */
app.get('/api/chats/:chatId', async (c) => {
  try {
    const chatId = c.req.param('chatId');
    const chat = getChat(chatId);
    
    if (!chat) {
      return c.json({ error: 'Chat not found' }, 404);
    }

    // TODO: Verify chat.orgId === c.get('orgId')
    
    return c.json(chat);
  } catch (error) {
    console.error('Error getting chat:', error);
    return c.json({ error: 'Failed to get chat' }, 500);
  }
});

/**
 * POST /api/chats/:chatId/messages
 * Send a message and stream the AI response
 */
app.post('/api/chats/:chatId/messages', async (c) => {
  try {
    const chatId = c.req.param('chatId');
    const orgId = c.get('orgId');
    
    // Verify chat exists
    const chat = getChat(chatId);
    if (!chat) {
      return c.json({ error: 'Chat not found' }, 404);
    }

    // TODO: Verify chat.orgId === orgId

    // Parse request body
    const bodySchema = z.object({
      content: z.string().min(1, 'Message content is required'),
      model: z.string().optional(),
    });

    const body = await c.req.json();
    const validation = bodySchema.safeParse(body);
    
    if (!validation.success) {
      return c.json({ 
        error: 'Invalid request', 
        details: validation.error.errors 
      }, 400);
    }

    const { content, model } = validation.data;

    // Validate model if provided
    if (model && !isValidModel(model)) {
      return c.json({ error: `Invalid model: ${model}` }, 400);
    }

    // Add user message to storage
    addMessage(chatId, { role: 'user', content });

    // Get chat history
    const messages = getMessages(chatId);

    // Get API key from environment
    const apiKey = c.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OPENROUTER_API_KEY not configured');
      return c.json({ error: 'Service configuration error' }, 500);
    }

    // Run agent and stream response
    const result = await runAgent({
      messages,
      apiKey,
      orgId,
      model,
      env: {
        LANGFUSE_PUBLIC_KEY: c.env.LANGFUSE_PUBLIC_KEY,
        LANGFUSE_SECRET_KEY: c.env.LANGFUSE_SECRET_KEY,
        LANGFUSE_HOST: c.env.LANGFUSE_HOST,
      },
    });

    // Stream SSE response
    return streamSSE(c, async (stream) => {
      let assistantMessage = '';

      try {
        // Stream text chunks
        for await (const chunk of result.textStream) {
          assistantMessage += chunk;
          await stream.writeSSE({
            event: 'text',
            data: chunk,
          });
        }

        // Send done event
        await stream.writeSSE({
          event: 'done',
          data: JSON.stringify({ 
            messageId: crypto.randomUUID(),
            finishReason: 'stop' 
          }),
        });

        // Save assistant message to storage
        addMessage(chatId, {
          role: 'assistant',
          content: assistantMessage,
        });
      } catch (error) {
        console.error('Error streaming response:', error);
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        });
      }
    });
  } catch (error) {
    console.error('Error handling message:', error);
    return c.json({ 
      error: 'Failed to process message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/models
 * List available models
 */
app.get('/api/models', (c) => {
  const models = [
    // Fast and affordable models
    { name: 'gpt-4.1-mini', description: 'Fast and affordable (default)' },
    { name: 'claude-3.5-haiku', description: 'Fast and affordable' },
    
    // Balanced models
    { name: 'gpt-4.1', description: 'Balanced performance' },
    { name: 'claude-3.5-sonnet', description: 'Balanced performance' },
    
    // Most capable models
    { name: 'gpt-o3', description: 'Most capable OpenAI model' },
    { name: 'claude-3.5-opus', description: 'Most capable Anthropic model' },
    
    // Open source models
    { name: 'llama-3.3-70b', description: 'Open source from Meta' },
    { name: 'deepseek-v3', description: 'Open source from DeepSeek' },
  ];
  
  return c.json({ models });
});

/**
 * 404 handler
 */
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

/**
 * Error handler
 */
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;

