import { chat, maxIterations } from '@tanstack/ai';
import { createOpenRouterChat } from '../ai/openrouter';
import { getAgentConfig } from '../tenants/config';
import { resolveSystemPrompt } from './prompts';
import { getAiTools } from '../tools';
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
  const openrouter = createOpenRouterChat(apiKey);
  const adapter = openrouter({ model });

  // 5. Get TanStack AI tools
  const tools = await getAiTools(agentId, { CONVEX_URL: env.CONVEX_URL }, {
    convexUrl: env.CONVEX_URL,
  });

  // 6. Convert messages to TanStack format
  const tanstackMessages = messages.map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: [{ type: 'text' as const, text: m.content }],
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

export { runAgentTanStack as runAgentTanStackSSE };
