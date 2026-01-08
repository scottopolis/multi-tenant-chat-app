import { chat, maxIterations, toServerSentEventsStream } from '@tanstack/ai';
import { createOpenRouterAdapter } from '../ai/openrouter';
import { getAgentConfig } from '../tenants/config';
import { resolveSystemPrompt } from './prompts';
import { getAiTools } from '../tools';
import { addMessage } from '../storage';
import type { RunAgentOptions } from './index';

const DEFAULT_MODEL = 'openai/gpt-4.1-mini';

/**
 * Run agent using TanStack AI with OpenRouter.
 *
 * This is the TanStack AI equivalent of runAgent() from the Agents SDK.
 * It provides model flexibility via OpenRouter (Claude, GPT, Gemini, Llama, etc.)
 *
 * @param options - Same options as runAgent()
 * @returns TanStack AI chat stream
 */
export async function runAgentTanStack(options: RunAgentOptions) {
  const { messages, apiKey, agentId, model: requestedModel, systemPrompt, env = {} } = options;

  // 1. Get agent configuration
  const agentConfig = await getAgentConfig(agentId, { CONVEX_URL: env.CONVEX_URL });

  // 2. Determine model - use OpenRouter format (provider/model)
  const model = requestedModel || agentConfig.model || DEFAULT_MODEL;

  // 3. Resolve system prompt
  const instructions = await resolveSystemPrompt(agentConfig, agentId, systemPrompt, env);

  // 4. Create OpenRouter adapter
  const adapter = createOpenRouterAdapter(model, apiKey);

  // 5. Get TanStack AI tools
  const tools = await getAiTools(agentId, { CONVEX_URL: env.CONVEX_URL }, {
    convexUrl: env.CONVEX_URL,
  });

  // 6. Convert messages to TanStack format (simple string content)
  const tanstackMessages = messages.map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }));

  // 7. Run chat with agent loop
  return chat({
    adapter,
    messages: tanstackMessages,
    tools,
    system: instructions,
    agentLoopStrategy: maxIterations(8),
  });
}

export interface RunAgentTanStackSSEOptions extends RunAgentOptions {
  chatId: string;
}

/**
 * Run agent and return SSE Response for streaming.
 * Persists the assistant's response to storage after streaming completes.
 *
 * @param options - RunAgentOptions plus chatId
 * @returns Response with SSE stream
 */
export async function runAgentTanStackSSE(options: RunAgentTanStackSSEOptions): Promise<Response> {
  const { chatId } = options;
  const stream = await runAgentTanStack(options);

  // Wrap stream to collect content for persistence
  let fullContent = '';

  async function* wrapStream() {
    for await (const chunk of stream) {
      // Collect content chunks
      if (chunk.type === 'content' && chunk.delta) {
        fullContent += chunk.delta;
      }
      yield chunk;
    }
    // After stream completes, persist the assistant message
    if (fullContent) {
      addMessage(chatId, { role: 'assistant', content: fullContent });
    }
  }

  const wrappedStream = wrapStream();
  const sseStream = toServerSentEventsStream(wrappedStream);

  return new Response(sseStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
