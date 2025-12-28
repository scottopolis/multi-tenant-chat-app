import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import type { AgentConfig } from '../tenants/types';

/**
 * Structured Output Tests
 * Focus: Verify outputSchema configuration flows to Agent constructor
 */

// Mock OpenAI Agents SDK - must be before imports
const mockAgent = vi.fn();
const mockRun = vi.fn();
const mockSetDefaultOpenAIKey = vi.fn();

vi.mock('@openai/agents', () => ({
  Agent: mockAgent,
  run: mockRun,
  setDefaultOpenAIKey: mockSetDefaultOpenAIKey,
}));

// Mock dependencies
vi.mock('../tenants/config', () => ({
  getAgentConfig: vi.fn(),
}));

vi.mock('../tools', () => ({
  getTools: vi.fn().mockResolvedValue([]),
}));

vi.mock('./prompts', () => ({
  resolveSystemPrompt: vi.fn().mockResolvedValue('Test prompt'),
  DEFAULT_SYSTEM_PROMPT: 'Default prompt',
}));

describe('Structured Output', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default successful run mock
    mockRun.mockResolvedValue({
      finalOutput: 'Test output',
      lastResponseId: 'test-response-id',
      completed: Promise.resolve(),
    });
  });

  it('should pass outputType to Agent when outputSchema is configured', async () => {
    const { getAgentConfig } = await import('../tenants/config');
    const { runAgent } = await import('./index');
    
    // Define a test schema
    const TestSchema = z.object({
      name: z.string(),
      value: z.number(),
    });

    // Mock agent config with outputSchema
    const mockConfig: AgentConfig = {
      agentId: 'test-extractor',
      orgId: 'test-org',
      name: 'Test Extractor',
      model: 'gpt-4.1-mini',
      outputSchema: TestSchema,
    };
    vi.mocked(getAgentConfig).mockResolvedValue(mockConfig);

    // Run agent
    await runAgent({
      messages: [{ role: 'user', content: 'Extract data' }],
      apiKey: 'test-key',
      agentId: 'test-extractor',
    });

    // Verify Agent was created with outputType
    expect(mockAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Extractor',
        model: 'gpt-4.1-mini',
        outputType: TestSchema,
      })
    );
  });

  it('should NOT include outputType when outputSchema is not configured', async () => {
    const { getAgentConfig } = await import('../tenants/config');
    const { runAgent } = await import('./index');
    
    // Mock agent config WITHOUT outputSchema
    const mockConfig: AgentConfig = {
      agentId: 'normal-agent',
      orgId: 'test-org',
      name: 'Normal Agent',
      model: 'gpt-4.1-mini',
    };
    vi.mocked(getAgentConfig).mockResolvedValue(mockConfig);

    // Run agent
    await runAgent({
      messages: [{ role: 'user', content: 'Hello' }],
      apiKey: 'test-key',
      agentId: 'normal-agent',
    });

    // Verify Agent was created WITHOUT outputType
    const callArgs = mockAgent.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('outputType');
    
    // Verify it still has the basic fields
    expect(callArgs.name).toBe('Normal Agent');
    expect(callArgs.model).toBe('gpt-4.1-mini');
  });

  it('should work with calendar-extractor example schema', async () => {
    const { getAgentConfig } = await import('../tenants/config');
    const { runAgent } = await import('./index');
    
    // Define calendar event schema (matching the example)
    const CalendarEventSchema = z.object({
      events: z.array(
        z.object({
          name: z.string().describe('Event name or title'),
          date: z.string().describe('Event date in ISO format'),
          time: z.string().nullable().optional().describe('Event time if specified'),
          participants: z.array(z.string()).describe('List of participants'),
        })
      ),
    });

    // Mock agent config matching calendar-extractor
    const mockConfig: AgentConfig = {
      agentId: 'calendar-extractor',
      orgId: 'platform',
      name: 'Calendar Event Extractor',
      systemPrompt: 'Extract calendar events from the supplied text.',
      model: 'gpt-4.1-mini',
      outputSchema: CalendarEventSchema,
    };
    vi.mocked(getAgentConfig).mockResolvedValue(mockConfig);

    // Run agent
    await runAgent({
      messages: [{ role: 'user', content: 'Meeting with Bob tomorrow at 2pm' }],
      apiKey: 'test-key',
      agentId: 'calendar-extractor',
    });

    // Verify Agent was created with the schema
    expect(mockAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Calendar Event Extractor',
        model: 'gpt-4.1-mini',
        outputType: CalendarEventSchema,
      })
    );
  });
});

