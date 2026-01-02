import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { createChat, getChat, listChats, addMessage, getMessages, updateChatConversationState } from './storage';
import { runAgent, isValidModel } from './agents/index';
import { z } from 'zod';
import { getTools } from './tools';
import documentRoutes from './routes/documents';
import twilioRoutes from './routes/twilio';

export { VoiceCallSession } from './voice/VoiceCallSession';

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

    // Validate model if provided
    if (model && !isValidModel(model)) {
      return c.json({ error: `Invalid model: ${model}` }, 400);
    }

    // Add user message to storage
    addMessage(chatId, { role: 'user', content });

    // Get chat history
    const messages = getMessages(chatId);

    // Get API key from environment (prefer OPENAI_API_KEY, fallback to OPENROUTER_API_KEY)
    const apiKey = c.env.OPENAI_API_KEY || c.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured');
      return c.json({ error: 'Service configuration error' }, 500);
    }

    // Run agent and stream response with conversation continuity
    const agentId = c.get('agentId');
    const result = await runAgent({
      messages,
      apiKey,
      agentId,
      model,
      previousResponseId: chat.lastResponseId, // Use previous response for context
      env: {
        LANGFUSE_PUBLIC_KEY: c.env.LANGFUSE_PUBLIC_KEY,
        LANGFUSE_SECRET_KEY: c.env.LANGFUSE_SECRET_KEY,
        LANGFUSE_HOST: c.env.LANGFUSE_HOST,
        CONVEX_URL: c.env.CONVEX_URL,
      },
    });

    console.log('[Stream] Agent result received, starting stream');

    // Stream SSE response using Agents SDK streaming
    // Docs: https://openai.github.io/openai-agents-js/guides/streaming/
    return streamSSE(c, async (stream) => {
      let assistantMessage = '';
      let chunkCount = 0;

      try {
        console.log('[Stream] Processing streamed agent response');
        
        // Get text stream from the StreamedRunResult
        // toTextStream() returns an async iterable of text deltas
        const textStream = result.toTextStream();
        
        for await (const textChunk of textStream) {
          chunkCount++;
          assistantMessage += textChunk;
          
          // Send each chunk as it arrives
          await stream.writeSSE({
            event: 'text',
            data: textChunk,
          });
        }

        // Wait for the stream to complete (important: ensures all output is flushed)
        await result.completed;

        console.log(`[Stream] Completed streaming. Total chunks: ${chunkCount}, message length: ${assistantMessage.length}`);

        // Save the lastResponseId for conversation continuity
        // This allows us to chain conversations using previousResponseId
        if (result.lastResponseId) {
          updateChatConversationState(chatId, {
            lastResponseId: result.lastResponseId,
          });
          console.log('[Stream] Saved lastResponseId for conversation continuity');
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
          responseId: result.lastResponseId,
        });
        console.log('[Stream] Saved assistant message to storage');
      } catch (error) {
        console.error('[Stream] Error streaming response:', error);
        console.error('[Stream] Error stack:', error instanceof Error ? error.stack : 'No stack');
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
 * List available OpenAI models
 */
app.get('/api/models', (c) => {
  const models = [
    // Fast and affordable models
    { name: 'gpt-4.1-mini', description: 'Fast and affordable (default)' },
    { name: 'gpt-4o-mini', description: 'Fast and affordable' },
    
    // Balanced models
    { name: 'gpt-4.1', description: 'Balanced performance' },
    { name: 'gpt-4o', description: 'Balanced performance' },
    
    // Most capable models
    { name: 'o1', description: 'Most capable reasoning model' },
    { name: 'o1-mini', description: 'Faster reasoning model' },
    { name: 'o3-mini', description: 'Latest reasoning model' },
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

