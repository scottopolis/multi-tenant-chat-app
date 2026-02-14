import { chat, maxIterations, toServerSentEventsStream } from '@tanstack/ai';
import { createOpenRouterAdapter } from '../ai/openrouter';
import { getAgentConfig } from '../tenants/config';
import { resolveSystemPrompt } from './prompts';
import { getAiTools } from '../tools';
import { addMessage } from '../storage';
import { convexMutation } from '../convex/client';
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
    systemPrompts: [instructions],
    agentLoopStrategy: maxIterations(8),
  });
}

export interface RunAgentTanStackSSEOptions extends RunAgentOptions {
  chatId: string;
  conversationId?: string;
}

/**
 * Run agent and return SSE Response for streaming.
 * Persists the assistant's response to Convex (if configured) or in-memory storage.
 *
 * @param options - RunAgentOptions plus chatId and optional conversationId
 * @returns Response with SSE stream
 */
export async function runAgentTanStackSSE(options: RunAgentTanStackSSEOptions): Promise<Response> {
  const { chatId, conversationId, agentId, env = {} } = options;
  const stream = await runAgentTanStack(options);

  // Track accumulated tool call arguments (they come in chunks)
  const toolCallArgs: Map<string, { name: string; args: string }> = new Map();
  let fullContent = '';

  async function persistEvent(event: {
    eventType: string;
    role?: string;
    content?: string;
    toolName?: string;
    toolCallId?: string;
    toolInput?: unknown;
    toolResult?: unknown;
    errorType?: string;
    errorMessage?: string;
  }) {
    if (conversationId && env.CONVEX_URL) {
      await convexMutation(env.CONVEX_URL, 'conversations:appendEvent', {
        agentId,
        conversationId,
        event,
      });
    }
  }

  async function* wrapStream() {
    for await (const chunk of stream) {
      // Collect content chunks
      if (chunk.type === 'content' && chunk.delta) {
        fullContent += chunk.delta;
      }

      // Track tool calls (arguments come incrementally)
      if (chunk.type === 'tool_call') {
        const { id, function: fn } = chunk.toolCall;
        const existing = toolCallArgs.get(id);
        if (existing) {
          existing.args += fn.arguments;
        } else {
          toolCallArgs.set(id, { name: fn.name, args: fn.arguments });
        }
      }

      // Persist tool result events
      if (chunk.type === 'tool_result') {
        // First, persist the tool_call event (now that we have complete args)
        const toolInfo = toolCallArgs.get(chunk.toolCallId);
        if (toolInfo) {
          let parsedInput: unknown = toolInfo.args;
          try {
            parsedInput = JSON.parse(toolInfo.args);
          } catch {
            // Keep as string if not valid JSON
          }
          await persistEvent({
            eventType: 'tool_call',
            toolName: toolInfo.name,
            toolCallId: chunk.toolCallId,
            toolInput: parsedInput,
          });
          toolCallArgs.delete(chunk.toolCallId);
        }

        // Then persist the tool_result event
        let parsedResult: unknown = chunk.content;
        try {
          parsedResult = JSON.parse(chunk.content);
        } catch {
          // Keep as string if not valid JSON
        }
        await persistEvent({
          eventType: 'tool_result',
          toolCallId: chunk.toolCallId,
          toolName: toolInfo?.name,
          toolResult: parsedResult,
        });
      }

      // Persist error events
      if (chunk.type === 'error') {
        await persistEvent({
          eventType: 'error',
          errorType: chunk.error.code || 'unknown',
          errorMessage: chunk.error.message,
        });
      }

      yield chunk;
    }

    // After stream completes, persist the assistant message
    if (fullContent) {
      if (conversationId && env.CONVEX_URL) {
        await persistEvent({
          eventType: 'message',
          role: 'assistant',
          content: fullContent,
        });
      } else {
        // Fallback to in-memory storage
        addMessage(chatId, { role: 'assistant', content: fullContent });
      }
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
