import { Hono } from 'hono';
import { createChat, getChat, listChats, addMessage, getMessages } from './storage';
import { runAgentTanStackSSE } from './agents/index';
import { z } from 'zod';
import documentRoutes from './routes/documents';
import twilioRoutes from './routes/twilio';
import voiceRoutes from './routes/voice';
import { dynamicCors } from './middleware';
import { convexMutation, convexQuery } from './convex/client';

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
 * 
 * Body: { sessionId, userId?, title?, context? }
 * - sessionId: Required, from widget localStorage
 * - userId: Optional, Clerk user ID for authenticated users
 * - title: Optional conversation title
 * - context: Optional { pageUrl, referrer, userAgent, locale, timezone, customMetadata }
 */
app.post('/api/chats', async (c) => {
  try {
    const agentId = c.get('agentId');
    const convexUrl = c.env.CONVEX_URL;

    const bodySchema = z.object({
      sessionId: z.string().min(1, 'sessionId is required'),
      userId: z.string().optional(),
      title: z.string().optional(),
      context: z.object({
        pageUrl: z.string().optional(),
        referrer: z.string().optional(),
        userAgent: z.string().optional(),
        locale: z.string().optional(),
        timezone: z.string().optional(),
        customMetadata: z.any().optional(),
      }).optional(),
    });

    const body = await c.req.json().catch(() => ({}));
    const validation = bodySchema.safeParse(body);

    if (!validation.success) {
      return c.json({ 
        error: 'Invalid request', 
        details: validation.error.issues 
      }, 400);
    }

    const { sessionId, userId, title, context } = validation.data;

    // Create conversation in Convex
    if (convexUrl) {
      const conversationId = await convexMutation<string>(convexUrl, 'conversations:create', {
        agentId,
        sessionId,
        userId,
        title,
        context,
      });

      if (!conversationId) {
        return c.json({ error: 'Failed to create conversation in Convex' }, 500);
      }

      return c.json({ id: conversationId }, 201);
    }

    // Fallback to in-memory storage if Convex not configured
    const orgId = c.get('orgId');
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
 * For Convex conversations, returns the conversation with events.
 * Access validation is done in the Convex query.
 */
app.get('/api/chats/:chatId', async (c) => {
  try {
    const chatId = c.req.param('chatId');
    const agentId = c.get('agentId');
    const convexUrl = c.env.CONVEX_URL;

    // Try Convex first if configured
    if (convexUrl) {
      const conversation = await convexQuery<{
        _id: string;
        events: Array<{
          seq: number;
          eventType: string;
          role?: string;
          content?: string;
          toolName?: string;
          toolCallId?: string;
          toolInput?: unknown;
          toolResult?: unknown;
          createdAt: number;
        }>;
        createdAt: number;
        updatedAt: number;
      }>(convexUrl, 'conversations:get', {
        agentId,
        conversationId: chatId,
      });

      if (conversation) {
        // Convert events to messages format for widget compatibility
        const messages = conversation.events
          .filter(e => e.eventType === 'message')
          .map(e => ({
            id: `${conversation._id}-${e.seq}`,
            chatId: conversation._id,
            role: e.role as 'user' | 'assistant' | 'system',
            content: e.content || '',
            createdAt: new Date(e.createdAt).toISOString(),
          }));

        return c.json({
          id: conversation._id,
          messages,
          createdAt: new Date(conversation.createdAt).toISOString(),
          updatedAt: new Date(conversation.updatedAt).toISOString(),
        });
      }
    }

    // Fallback to in-memory storage
    const chat = getChat(chatId);
    if (!chat) {
      return c.json({ error: 'Chat not found' }, 404);
    }
    
    return c.json(chat);
  } catch (error) {
    console.error('Error getting chat:', error);
    return c.json({ error: 'Failed to get chat' }, 500);
  }
});

/**
 * POST /api/chats/:chatId/messages
 * Send a message and stream the AI response
 * 
 * Persists user message and assistant response events to Convex.
 */
app.post('/api/chats/:chatId/messages', async (c) => {
  try {
    const chatId = c.req.param('chatId');
    const agentId = c.get('agentId');
    const convexUrl = c.env.CONVEX_URL;

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
        details: validation.error.issues 
      }, 400);
    }

    const { content, model } = validation.data;

    // Determine message history source and persist user message
    let messages: Array<{ role: string; content: string }>;

    if (convexUrl) {
      // Persist user message to Convex
      await convexMutation(convexUrl, 'conversations:appendEvent', {
        agentId,
        conversationId: chatId,
        event: {
          eventType: 'message',
          role: 'user',
          content,
        },
      });

      // Get conversation history from Convex
      const conversation = await convexQuery<{
        events: Array<{
          eventType: string;
          role?: string;
          content?: string;
        }>;
      }>(convexUrl, 'conversations:get', {
        agentId,
        conversationId: chatId,
      });

      if (!conversation) {
        return c.json({ error: 'Chat not found' }, 404);
      }

      // Convert events to messages for LLM
      messages = conversation.events
        .filter(e => e.eventType === 'message' && e.role && e.content)
        .map(e => ({
          role: e.role as string,
          content: e.content as string,
        }));
    } else {
      // Fallback to in-memory storage
      const chat = getChat(chatId);
      if (!chat) {
        return c.json({ error: 'Chat not found' }, 404);
      }
      addMessage(chatId, { role: 'user', content });
      messages = getMessages(chatId);
    }

    // Get API key
    const apiKey = c.env.OPENROUTER_API_KEY || c.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('API key not configured');
      return c.json({ error: 'Service configuration error' }, 500);
    }

    // Run agent with TanStack AI + OpenRouter
    return runAgentTanStackSSE({
      messages,
      apiKey,
      agentId,
      model,
      chatId,
      conversationId: convexUrl ? chatId : undefined,
      env: {
        CONVEX_URL: convexUrl,
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

