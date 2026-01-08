/**
 * Agent configuration and execution using TanStack AI + OpenRouter
 *
 * Features:
 * - Multi-provider support via OpenRouter (GPT, Claude, Gemini, Llama, etc.)
 * - Langfuse prompt management (optional)
 * - Agent-specific configuration from Convex
 * - Knowledge base search via Convex RAG
 *
 * Architecture:
 * - Each agent belongs to an organization (orgId)
 * - One org can have multiple agents with different configs
 * - Agents are identified by unique agentId
 *
 * TODO: Advanced configuration
 * - Temperature and other generation parameters
 * - Token limits and rate limiting
 * - Structured output support
 */

export interface RunAgentOptions {
  messages: Array<{ role: string; content: string }>;
  apiKey: string;
  agentId: string;
  model?: string;
  systemPrompt?: string;
  env?: {
    LANGFUSE_PUBLIC_KEY?: string;
    LANGFUSE_SECRET_KEY?: string;
    LANGFUSE_HOST?: string;
    CONVEX_URL?: string;
  };
}

// TanStack AI runner
export { runAgentTanStack, runAgentTanStackSSE } from './tanstack';
export type { RunAgentTanStackSSEOptions } from './tanstack';
