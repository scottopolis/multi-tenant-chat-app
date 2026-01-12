import { Hono } from 'hono';
import { createChat, getChat, listChats, addMessage, getMessages } from './storage';
import { runAgentTanStackSSE } from './agents/index';
import { z } from 'zod';
import documentRoutes from './routes/documents';
import twilioRoutes from './routes/twilio';
import voiceRoutes from './routes/voice';
import { dynamicCors } from './middleware';

export { VoiceCallSession } from './voice/VoiceCallSession';
export { WebVoiceSession } from './voice/WebVoiceSession';

/**
 * Cloudflare Worker environment bindings
 */
type Bindings = {
  OPENAI_API_KEY: string;
  OPENROUTER_API_KEY?: string; // Deprecated, keeping for backward compatibility
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_HOST?: string;
  CONVEX_URL?: string; // Convex deployment URL for agent configs
  VOICE_CALL_SESSION: import('@cloudflare/workers-types').DurableObjectNamespace; // Durable Object for voice calls
  WEB_VOICE_SESSION: import('@cloudflare/workers-types').DurableObjectNamespace; // Durable Object for web voice preview
};

type Variables = {
  agentId: string;
  orgId: string;
  userId?: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * CORS Middleware
 * 
 * Handles preflight OPTIONS requests permissively.
 * For actual requests, CORS headers are set after origin validation
 * in the auth middleware or by this middleware for public routes.
 */
app.use('*', dynamicCors());

/**
 * Auth Middleware (Placeholder)
 * 
 * MVP: Extract agent ID from query parameter ?agent=acme-support
 * 
 * TODO: Auth middleware for production
 * - Verify JWT from Authorization header
 * - Extract orgId and userId from JWT payload
 * - Agent ID can come from query param or be inferred from org
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
 *     c.set('orgId', payload.orgId);
 *     c.set('userId', payload.userId);
 *     c.set('agentId', c.req.query('agent') || 'default');
 *   } catch (error) {
 *     return c.json({ error: 'Invalid token' }, 401);
 *   }
 */
app.use('*', async (c, next) => {
  // MVP: Get agent from query param
  const agentParam = c.req.query('agent');
  const agentId = agentParam && agentParam.trim() !== '' ? agentParam : 'default';
  
  // Get agent config to extract orgId (pass env for Convex access)
  const { getAgentConfig } = await import('./tenants/config');
  const agentConfig = await getAgentConfig(agentId, { CONVEX_URL: c.env.CONVEX_URL });
  
  c.set('agentId', agentId);
  c.set('orgId', agentConfig.orgId);
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
 * Document routes (RAG knowledge base)
 */
app.route('/api/documents', documentRoutes);

/**
 * Twilio voice routes (Voice Agents)
 */
app.route('/twilio', twilioRoutes);

/**
 * Voice preview routes (Web Voice)
 */
app.route('/voice', voiceRoutes);


/**
 * POST /api/chats
 * Create a new chat for the current agent
 */
app.post('/api/chats', async (c) => {
  try {
    const orgId = c.get('orgId');
    const agentId = c.get('agentId');
    const body = await c.req.json().catch(() => ({}));
    const title = body.title;

    const chat = createChat(orgId, agentId, title);
    
    return c.json(chat, 201);
  } catch (error) {
    console.error('Error creating chat:', error);
    return c.json({ error: 'Failed to create chat' }, 500);
  }
});

/**
 * GET /api/chats
 * List all chats for the current org and agent
 */
app.get('/api/chats', async (c) => {
  try {
    const orgId = c.get('orgId');
    const agentId = c.get('agentId');
    const chats = listChats(orgId, agentId);
    
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

    // Add user message to storage
    addMessage(chatId, { role: 'user', content });

    // Get chat history
    const messages = getMessages(chatId);

    // Get API key (prefer OPENROUTER_API_KEY for multi-provider support)
    const apiKey = c.env.OPENROUTER_API_KEY || c.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('API key not configured');
      return c.json({ error: 'Service configuration error' }, 500);
    }

    // Run agent with TanStack AI + OpenRouter
    const agentId = c.get('agentId');
    
    return runAgentTanStackSSE({
      messages,
      apiKey,
      agentId,
      model,
      chatId,
      env: {
        CONVEX_URL: c.env.CONVEX_URL,
      },
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
 * List available models via OpenRouter
 */
app.get('/api/models', (c) => {
  const models = [
    // OpenAI models
    { name: 'GPT-4.1 Mini', id: 'openai/gpt-4.1-mini', description: 'Fast and affordable (default)' },
    { name: 'GPT-4.1', id: 'openai/gpt-4.1', description: 'Balanced performance' },
    { name: 'GPT-4o', id: 'openai/gpt-4o', description: 'Latest GPT-4' },
    
    // Anthropic models
    { name: 'Claude Sonnet 4', id: 'anthropic/claude-sonnet-4', description: 'Anthropic Claude' },
    { name: 'Claude Haiku 3.5', id: 'anthropic/claude-3.5-haiku', description: 'Fast Claude' },
    
    // Google models
    { name: 'Gemini 2.0 Flash', id: 'google/gemini-2.0-flash', description: 'Google Gemini' },
    
    // Open source models
    { name: 'Llama 3.3 70B', id: 'meta-llama/llama-3.3-70b-instruct', description: 'Meta Llama' },
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

