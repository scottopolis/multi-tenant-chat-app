import { streamText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { getTools } from '../tools';

/**
 * Agent configuration and execution
 * 
 * TODO: Langfuse prompt management
 * - Fetch system prompt from Langfuse instead of hardcoding
 * - Support prompt versioning and A/B testing
 * - Example:
 *   const langfuse = new Langfuse({ publicKey, secretKey });
 *   const prompt = await langfuse.getPrompt("base-assistant", { label: orgId });
 *   const systemPrompt = prompt.prompt;
 * 
 * TODO: Org-specific configuration
 * - Model selection per org (gpt-4.1-mini, claude-sonnet-4.5, etc.)
 * - Temperature and other generation parameters
 * - Custom system prompts per org
 * - Token limits and rate limiting
 * 
 * TODO: Langfuse tracing via experimental_telemetry
 * - Track agent executions, token usage, costs
 * - Monitor tool calls and performance
 * - Example:
 *   experimental_telemetry: {
 *     isEnabled: true,
 *     functionId: "chat-agent",
 *     metadata: { orgId, chatId, userId },
 *   }
 */

export interface RunAgentOptions {
  messages: Array<{ role: string; content: string }>;
  apiKey: string;
  orgId: string;
  model?: string;
  systemPrompt?: string;
}

/**
 * Available models via OpenRouter
 * Add or remove models as needed
 */
export const AVAILABLE_MODELS = {
  // Fast and affordable models
  'gpt-4.1-mini': 'openai/gpt-4.1-mini',
  'claude-3.5-haiku': 'anthropic/claude-3.5-haiku',
  
  // Balanced models
  'gpt-4.1': 'openai/gpt-4.1',
  'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
  
  // Most capable models
  'gpt-o3': 'openai/o3',
  'claude-3.5-opus': 'anthropic/claude-3.5-opus',
  
  // Open source models
  'llama-3.3-70b': 'meta-llama/llama-3.3-70b-instruct',
  'deepseek-v3': 'deepseek/deepseek-chat',
} as const;

export type ModelName = keyof typeof AVAILABLE_MODELS;

const DEFAULT_MODEL: ModelName = 'gpt-4.1-mini';
const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. You have access to various tools that you can use to help users.

Be concise and clear in your responses. When using tools, explain what you're doing and why.`;

/**
 * Run the agent with streaming response
 * 
 * This function:
 * 1. Creates an OpenRouter provider with the API key
 * 2. Loads the appropriate tools for the org
 * 3. Calls streamText with the model, messages, and tools
 * 4. Returns the streaming result
 */
export async function runAgent(options: RunAgentOptions) {
  const {
    messages,
    apiKey,
    orgId,
    model = DEFAULT_MODEL,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
  } = options;

  // Create OpenRouter provider
  const openrouter = createOpenRouter({
    apiKey,
  });

  // Get model ID (handle both short names and full IDs)
  const modelId = AVAILABLE_MODELS[model as ModelName] || model;

  // Get tools for this org
  const tools = getTools(orgId);

  // Prepare messages with system prompt
  const messagesWithSystem = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];

  // Stream the response
  const result = streamText({
    model: openrouter.chat(modelId),
    messages: messagesWithSystem,
    tools,
    maxSteps: 5, // Allow up to 5 tool use iterations
    // TODO: Add Langfuse telemetry
    // experimental_telemetry: {
    //   isEnabled: true,
    //   functionId: 'chat-agent',
    //   metadata: {
    //     orgId,
    //     model: modelId,
    //   },
    // },
  });

  return result;
}

/**
 * Validate if a model name is supported
 */
export function isValidModel(model: string): boolean {
  return model in AVAILABLE_MODELS;
}

/**
 * Get list of available models
 */
export function getAvailableModels(): Array<{ name: string; id: string }> {
  return Object.entries(AVAILABLE_MODELS).map(([name, id]) => ({
    name,
    id,
  }));
}

