import { Agent, run } from '@openai/agents';
import { setDefaultOpenAIKey } from '@openai/agents';
import { getTools } from '../tools';
import { getAgentConfig } from '../tenants/config';
import { resolveSystemPrompt, DEFAULT_SYSTEM_PROMPT } from './prompts';

/**
 * Agent configuration and execution
 * 
 * ✅ Langfuse prompt management - Optional integration
 * - Fetches system prompt from Langfuse by agent ID
 * - Supports prompt versioning via labels
 * - Falls back to agent's systemPrompt, then default prompt
 * - Priority: Langfuse → agent.systemPrompt → DEFAULT_SYSTEM_PROMPT
 * 
 * ✅ Agent-specific configuration - Implemented
 * - Model selection per agent (gpt-4.1-mini, claude-sonnet-4.5, etc.)
 * - Custom systemPrompt per agent
 * - Optional Langfuse integration per agent
 * - MCP tool servers per agent
 * 
 * Architecture:
 * - Each agent belongs to an organization (orgId)
 * - One org can have multiple agents with different configs
 * - Agents are identified by unique agentId
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
 *     metadata: { agentId, orgId, chatId, userId },
 *   }
 */

export interface RunAgentOptions {
  messages: Array<{ role: string; content: string }>;
  apiKey: string;
  agentId: string;
  model?: string;
  systemPrompt?: string;
  previousResponseId?: string; // For conversation continuity
  env?: {
    LANGFUSE_PUBLIC_KEY?: string;
    LANGFUSE_SECRET_KEY?: string;
    LANGFUSE_HOST?: string;
  };
}

/**
 * Available OpenAI models
 * Note: After migrating to OpenAI Agents SDK, only OpenAI models are supported
 */
export const AVAILABLE_MODELS = {
  // Fast and affordable models
  'gpt-4.1-mini': 'gpt-4.1-mini',
  'gpt-4o-mini': 'gpt-4o-mini',
  
  // Balanced models
  'gpt-4.1': 'gpt-4.1',
  'gpt-4o': 'gpt-4o',
  
  // Most capable models
  'o1': 'o1',
  'o1-mini': 'o1-mini',
  'o3-mini': 'o3-mini',
} as const;

export type ModelName = keyof typeof AVAILABLE_MODELS;

const DEFAULT_MODEL: ModelName = 'gpt-4.1-mini';

/**
 * Run the agent with streaming response using OpenAI Agents SDK
 * 
 * This function:
 * 1. Fetches tenant configuration (includes systemPrompt, Langfuse, model, tools config)
 * 2. Determines system prompt (priority: Langfuse → tenant.systemPrompt → default)
 * 3. Creates an Agent instance with instructions and tools
 * 4. Runs the agent with conversation continuity via previousResponseId
 * 5. Returns the streaming result (StreamedRunResult)
 * 
 * Conversation continuity pattern:
 * - Pass previousResponseId from the last turn to maintain context
 * - Save result.lastResponseId after each turn for the next request
 * - This chains conversations without sending full history each time
 * 
 * Docs: https://openai.github.io/openai-agents-js/guides/streaming/
 */
export async function runAgent(options: RunAgentOptions): Promise<any> {
  const {
    messages,
    apiKey,
    agentId,
    model: requestedModel,
    systemPrompt: providedSystemPrompt,
    previousResponseId,
    env = {},
  } = options;

  // 1. Get agent configuration
  const agentConfig = await getAgentConfig(agentId);

  // 2. Determine model (priority: request > agent config > default)
  const model = requestedModel || agentConfig.model || DEFAULT_MODEL;
  const modelId = AVAILABLE_MODELS[model as ModelName] || model;

  // 3. Determine system prompt (now called "instructions" in Agents SDK)
  // Priority: providedSystemPrompt → Langfuse → agent.systemPrompt → DEFAULT_SYSTEM_PROMPT
  const instructions = await resolveSystemPrompt(
    agentConfig,
    agentId,
    providedSystemPrompt,
    env
  );

  // 4. Set the OpenAI API key globally for this request
  // The Agents SDK requires the API key to be set before creating/running agents
  setDefaultOpenAIKey(apiKey);

  // 5. Get tools for this agent (now returns array)
  const tools = await getTools(agentId);

  // 6. Create Agent instance
  const agent = new Agent({
    name: agentConfig.name || agentId,
    instructions,
    model: modelId,
    tools,
  });

  // 7. Get the last user message
  const userMessages = messages.filter(m => m.role === 'user');
  const lastUserMessage = userMessages[userMessages.length - 1];
  
  if (!lastUserMessage) {
    throw new Error('No user message found');
  }

  // 8. Run the agent with streaming and conversation continuity
  // Using previousResponseId to chain conversations - this keeps the context
  // alive across turns without creating a full conversation resource
  const runOptions: any = {
    stream: true, // Enable streaming for real-time responses
  };

  // Add previousResponseId if available for conversation continuity
  if (previousResponseId) {
    runOptions.previousResponseId = previousResponseId;
  }

  const result = await run(agent, lastUserMessage.content, runOptions);

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

