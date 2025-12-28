import { streamText, type CoreMessage } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { getTools } from '../tools';
import { getTenantConfig } from '../tenants/config';
import { resolveSystemPrompt, DEFAULT_SYSTEM_PROMPT } from './prompts';

/**
 * Agent configuration and execution
 * 
 * ✅ Langfuse prompt management - Optional integration
 * - Fetches system prompt from Langfuse by tenant/org ID
 * - Supports prompt versioning via labels
 * - Falls back to tenant's systemPrompt, then default prompt
 * - Priority: Langfuse → tenant.systemPrompt → DEFAULT_SYSTEM_PROMPT
 * 
 * ✅ Org-specific configuration - Implemented
 * - Model selection per org (gpt-4.1-mini, claude-sonnet-4.5, etc.)
 * - Custom systemPrompt per tenant
 * - Optional Langfuse integration per tenant
 * 
 * TODO: Advanced configuration
 * - Temperature and other generation parameters
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
  env?: {
    LANGFUSE_PUBLIC_KEY?: string;
    LANGFUSE_SECRET_KEY?: string;
    LANGFUSE_HOST?: string;
  };
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

/**
 * Run the agent with streaming response
 * 
 * This function:
 * 1. Fetches tenant configuration (includes systemPrompt, Langfuse, model, tools config)
 * 2. Determines system prompt (priority: Langfuse → tenant.systemPrompt → default)
 * 3. Creates an OpenRouter provider with the API key
 * 4. Loads the appropriate tools for the org
 * 5. Calls streamText with the model, messages, and tools
 * 6. Returns the streaming result
 */
export async function runAgent(options: RunAgentOptions) {
  const {
    messages,
    apiKey,
    orgId,
    model: requestedModel,
    systemPrompt: providedSystemPrompt,
    env = {},
  } = options;

  // 1. Get tenant configuration
  const tenantConfig = await getTenantConfig(orgId);

  // 2. Determine model (priority: request > tenant config > default)
  const model = requestedModel || tenantConfig.model || DEFAULT_MODEL;

  // 3. Determine system prompt
  // Priority: providedSystemPrompt → Langfuse → tenant.systemPrompt → DEFAULT_SYSTEM_PROMPT
  const systemPrompt = await resolveSystemPrompt(
    tenantConfig,
    orgId,
    providedSystemPrompt,
    env
  );

  // 4. Create OpenRouter provider
  const openrouter = createOpenRouter({
    apiKey,
  });

  // 5. Get model ID (handle both short names and full IDs)
  const modelId = AVAILABLE_MODELS[model as ModelName] || model;

  // 6. Get tools for this org (now async - includes MCP tools)
  const tools = await getTools(orgId);

  // 7. Prepare messages with system prompt
  const messagesWithSystem: CoreMessage[] = [
    { role: 'system', content: systemPrompt } as CoreMessage,
    ...messages.map(m => ({ role: m.role, content: m.content }) as CoreMessage),
  ];

  // 8. Stream the response
  const result = streamText({
    model: openrouter.chat(modelId) as any, // Type compatibility issue with OpenRouter provider
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

