import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import type { AgentConfig } from '../tenants/types';

vi.mock('@tanstack/ai', () => ({
  chat: vi.fn().mockResolvedValue([]),
  maxIterations: vi.fn().mockReturnValue({}),
}));

vi.mock('../ai/openrouter', () => ({
  createOpenRouterAdapter: vi.fn().mockReturnValue({ name: 'adapter' }),
}));

vi.mock('../tenants/config', () => ({
  getAgentConfig: vi.fn(),
}));

vi.mock('./prompts', () => ({
  resolveSystemPrompt: vi.fn().mockResolvedValue('Resolved prompt'),
}));

vi.mock('../tools', () => ({
  getAiTools: vi.fn().mockResolvedValue([]),
}));

describe('Structured Output', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run even when outputSchema is configured (no structured output support yet)', async () => {
    const { getAgentConfig } = await import('../tenants/config');
    const { runAgentTanStack } = await import('./tanstack');
    const { chat } = await import('@tanstack/ai');

    const TestSchema = z.object({
      name: z.string(),
      value: z.number(),
    });

    const mockConfig: AgentConfig = {
      agentId: 'test-extractor',
      orgId: 'test-org',
      name: 'Test Extractor',
      model: 'openai/gpt-4.1-mini',
      outputSchema: TestSchema,
    };

    vi.mocked(getAgentConfig).mockResolvedValue(mockConfig);

    await runAgentTanStack({
      messages: [{ role: 'user', content: 'Extract data' }],
      apiKey: 'test-key',
      agentId: 'test-extractor',
    });

    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'Resolved prompt',
      })
    );
  });

  it('should run when outputSchema is not configured', async () => {
    const { getAgentConfig } = await import('../tenants/config');
    const { runAgentTanStack } = await import('./tanstack');
    const { chat } = await import('@tanstack/ai');

    const mockConfig: AgentConfig = {
      agentId: 'normal-agent',
      orgId: 'test-org',
      name: 'Normal Agent',
      model: 'openai/gpt-4.1-mini',
    };

    vi.mocked(getAgentConfig).mockResolvedValue(mockConfig);

    await runAgentTanStack({
      messages: [{ role: 'user', content: 'Hello' }],
      apiKey: 'test-key',
      agentId: 'normal-agent',
    });

    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'Resolved prompt',
      })
    );
  });
});
