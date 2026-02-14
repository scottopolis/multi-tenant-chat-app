import { getLangfuseClient, getPromptByTenant, isLangfuseConfigured } from '../langfuse';
import type { AgentConfig } from '../tenants/types';

/**
 * Default system prompt used when no other prompt is configured
 */
export const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant. You have access to various tools that you can use to help users.

Be concise and clear in your responses. When using tools, explain what you're doing and why.`;

/**
 * Environment variables for Langfuse integration
 */
export interface LangfuseEnv {
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_HOST?: string;
}

/**
 * Resolve system prompt with priority: providedSystemPrompt → Langfuse → agent.systemPrompt → DEFAULT_SYSTEM_PROMPT
 * 
 * This function:
 * 1. Returns providedSystemPrompt if given (highest priority)
 * 2. Checks if agent has Langfuse configuration
 *    - If using platform credentials (PLATFORM_KEY), fetches from platform Langfuse
 *    - If has own credentials, fetches from agent's Langfuse account
 * 3. Falls back to platform Langfuse if configured (without label)
 * 4. Falls back to agent's configured systemPrompt
 * 5. Falls back to DEFAULT_SYSTEM_PROMPT (lowest priority)
 * 
 * @param agentConfig - Agent configuration with potential Langfuse settings
 * @param agentId - Agent ID for logging
 * @param providedSystemPrompt - Optional system prompt provided directly
 * @param env - Environment variables with Langfuse credentials
 * @returns Resolved system prompt
 */
export async function resolveSystemPrompt(
  agentConfig: AgentConfig,
  agentId: string,
  providedSystemPrompt?: string,
  env: LangfuseEnv = {}
): Promise<string> {
  // 1. If system prompt is directly provided, use it
  if (providedSystemPrompt) {
    return providedSystemPrompt;
  }

  // 2. Try to fetch from Langfuse
  let systemPrompt: string | undefined;
  let langfuseCredentials: { publicKey: string; secretKey: string; host?: string } | null = null;
  let promptName = 'base-assistant';
  let promptLabel: string | undefined = undefined;

  // Check if agent has their own Langfuse configuration
  if (agentConfig.langfuse) {
    const { publicKey, secretKey, host, promptName: configuredPromptName, label } = agentConfig.langfuse;

    // Check if agent is using platform credentials (special marker)
    if (publicKey === 'PLATFORM_KEY' || secretKey === 'PLATFORM_KEY') {
      // Use platform credentials
      if (isLangfuseConfigured(env)) {
        langfuseCredentials = {
          publicKey: env.LANGFUSE_PUBLIC_KEY!,
          secretKey: env.LANGFUSE_SECRET_KEY!,
          host: env.LANGFUSE_HOST,
        };
        promptName = configuredPromptName || promptName;
        promptLabel = label; // Only use label if explicitly configured
        console.log(`[Agent] Using platform Langfuse with custom prompt: ${promptName}${label ? ` (label: ${label})` : ''}`);
      }
    } else if (publicKey && secretKey) {
      // Use agent's own Langfuse credentials (only if both keys are provided)
      langfuseCredentials = {
        publicKey,
        secretKey,
        host,
      };
      promptName = configuredPromptName || promptName;
      promptLabel = label; // Only use label if explicitly configured
      console.log(`[Agent] Using agent's Langfuse account: ${agentId}${label ? ` (label: ${label})` : ''}`);
    }
  } else if (isLangfuseConfigured(env)) {
    // Fall back to platform credentials (without label)
    langfuseCredentials = {
      publicKey: env.LANGFUSE_PUBLIC_KEY!,
      secretKey: env.LANGFUSE_SECRET_KEY!,
      host: env.LANGFUSE_HOST,
    };
    // Don't set promptLabel - fetch default/production version
    console.log(`[Agent] Using platform Langfuse for agent: ${agentId}`);
  }

  // Fetch prompt from Langfuse if credentials available
  if (langfuseCredentials) {
    try {
      const langfuse = getLangfuseClient(langfuseCredentials);
      systemPrompt = await getPromptByTenant(
        langfuse,
        promptName,
        promptLabel // Only pass label if explicitly configured
      );
      const labelInfo = promptLabel ? ` (label: ${promptLabel})` : ' (default version)';
      console.log(`[Agent] Fetched prompt from Langfuse: ${promptName}${labelInfo}`);
    } catch (error) {
      console.error(`[Agent] Failed to fetch Langfuse prompt:`, error);
      // Don't set systemPrompt here, let it fall through to next fallback
    }
  }

  // 3. Fallback to agent's configured systemPrompt if Langfuse didn't provide one
  if (!systemPrompt && agentConfig.systemPrompt) {
    systemPrompt = agentConfig.systemPrompt;
    console.log(`[Agent] Using agent's configured systemPrompt`);
  }

  // 4. Final fallback to default
  if (!systemPrompt) {
    systemPrompt = DEFAULT_SYSTEM_PROMPT;
    console.log(`[Agent] Using default system prompt`);
  }

  return systemPrompt;
}
