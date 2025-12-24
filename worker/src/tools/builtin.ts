import { tool } from 'ai';
import { z } from 'zod';

/**
 * Built-in tools available to all agents
 * 
 * TODO: Add more built-in tools:
 * - webSearch: Search the web using a search API (Brave, Serper, etc.)
 * - sendEmail: Send emails via SendGrid or similar
 * - createCalendarEvent: Create calendar events via Google Calendar API
 * - getWeather: Fetch weather data
 * - fetchUrl: Fetch content from a URL
 */

/**
 * Simple example tool that returns the current time
 */
export const currentTime = tool({
  description: 'Get the current date and time',
  parameters: z.object({
    timezone: z.string().optional().describe('Timezone (e.g., "America/New_York"). Defaults to UTC.'),
  }),
  execute: async ({ timezone }) => {
    const now = new Date();
    const timeString = timezone 
      ? now.toLocaleString('en-US', { timeZone: timezone })
      : now.toISOString();
    
    return {
      timestamp: now.toISOString(),
      formatted: timeString,
      timezone: timezone || 'UTC',
    };
  },
});

/**
 * Example calculator tool
 */
export const calculator = tool({
  description: 'Perform basic arithmetic operations',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']).describe('The arithmetic operation to perform'),
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }),
  execute: async ({ operation, a, b }) => {
    let result: number;
    
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) {
          throw new Error('Cannot divide by zero');
        }
        result = a / b;
        break;
    }
    
    return {
      operation,
      a,
      b,
      result,
    };
  },
});

// Export all built-in tools
export const builtinTools = {
  currentTime,
  calculator,
};

