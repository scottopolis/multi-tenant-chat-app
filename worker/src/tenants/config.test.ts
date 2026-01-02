import { describe, it, expect } from 'vitest';
import { getAgentConfig } from './config';
import { z } from 'zod';

/**
 * Agent Configuration Tests - Structured Output
 * Focus: Verify outputSchema is properly configured for agents
 */

describe('Agent Configuration - Structured Output', () => {
  it('should have outputSchema configured for calendar-extractor', async () => {
    const config = await getAgentConfig('calendar-extractor');
    
    expect(config).toBeDefined();
    expect(config.agentId).toBe('calendar-extractor');
    expect(config.outputSchema).toBeDefined();
    
    // Verify the schema is a valid Zod schema
    expect(config.outputSchema).toBeInstanceOf(z.ZodObject);
  });

  it('should NOT have outputSchema for default agent', async () => {
    const config = await getAgentConfig('default');
    
    expect(config).toBeDefined();
    expect(config.agentId).toBe('default');
    expect(config.outputSchema).toBeUndefined();
  });

  it('calendar-extractor schema should validate correct data', async () => {
    const config = await getAgentConfig('calendar-extractor');
    
    // Valid calendar event data
    const validData = {
      events: [
        {
          name: 'Team Meeting',
          date: '2024-12-30',
          time: '2:00 PM',
          participants: ['Alice', 'Bob'],
          location: 'Conference Room A',
        },
      ],
    };

    // Should not throw
    expect(() => config.outputSchema!.parse(validData)).not.toThrow();
  });

  it('calendar-extractor schema should reject invalid data', async () => {
    const config = await getAgentConfig('calendar-extractor');
    
    // Invalid data (missing required fields)
    const invalidData = {
      events: [
        {
          // Missing 'name' and 'date'
          time: '2:00 PM',
        },
      ],
    };

    // Should throw validation error
    expect(() => config.outputSchema!.parse(invalidData)).toThrow();
  });
});


