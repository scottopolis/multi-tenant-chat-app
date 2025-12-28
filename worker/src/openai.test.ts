/**
 * Test for OpenAI API and Agents SDK compatibility in Cloudflare Workers
 * 
 * This test verifies that:
 * 1. The OpenAI SDK works with nodejs_compat flag
 * 2. The Agents SDK works with nodejs_compat flag
 * 3. Basic API calls succeed
 * 4. Environment variables are accessible
 */

import { describe, it, expect } from 'vitest';
import OpenAI from 'openai';
import { Agent, tool, run, setDefaultOpenAIKey } from '@openai/agents';
import { z } from 'zod';

describe('OpenAI API Compatibility', () => {
  it('should create an OpenAI client instance', () => {
    const client = new OpenAI({
      apiKey: 'test-key-for-instantiation'
    });
    
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(OpenAI);
  });

  it('should make a basic API call (requires OPENAI_API_KEY)', async () => {
    // Skip if no API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.includes('your-api-key')) {
      console.log('Skipping API call test - no valid OPENAI_API_KEY found');
      return;
    }

    const client = new OpenAI({ apiKey });

    // Make a minimal API call to verify connectivity
    const response = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'user', content: 'Say "test successful" and nothing else.' }
      ],
      max_tokens: 10
    });

    expect(response).toBeDefined();
    expect(response.choices).toBeDefined();
    expect(response.choices.length).toBeGreaterThan(0);
    expect(response.choices[0].message.content).toBeTruthy();
    
    console.log('✅ OpenAI API call successful:', response.choices[0].message.content);
  }, 15000); // 15s timeout for API call

  it('should handle streaming responses', async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.includes('your-api-key')) {
      console.log('Skipping streaming test - no valid OPENAI_API_KEY found');
      return;
    }

    const client = new OpenAI({ apiKey });

    const stream = await client.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'user', content: 'Count to 3' }
      ],
      stream: true,
      max_tokens: 20
    });

    let chunks = 0;
    for await (const chunk of stream) {
      chunks++;
      expect(chunk).toBeDefined();
      expect(chunk.choices).toBeDefined();
    }

    expect(chunks).toBeGreaterThan(0);
    console.log(`✅ Streaming test successful: received ${chunks} chunks`);
  }, 15000);
});

describe('OpenAI Agents SDK Compatibility', () => {
  it('should create an Agent instance', () => {
    const testTool = tool({
      name: 'test_tool',
      description: 'A test tool',
      parameters: z.object({}),
      execute: async () => 'test result',
    });

    const agent = new Agent({
      name: 'Test Agent',
      instructions: 'You are a helpful test agent.',
      tools: [testTool],
    });

    expect(agent).toBeDefined();
    expect(agent.name).toBe('Test Agent');
    expect(agent.instructions).toBe('You are a helpful test agent.');
  });

  it('should define a tool with Zod parameters', () => {
    const calculatorTool = tool({
      name: 'calculator',
      description: 'Performs basic math operations',
      parameters: z.object({
        operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
        a: z.number(),
        b: z.number(),
      }),
      execute: async ({ operation, a, b }) => {
        switch (operation) {
          case 'add': return a + b;
          case 'subtract': return a - b;
          case 'multiply': return a * b;
          case 'divide': return a / b;
          default: throw new Error('Invalid operation');
        }
      },
    });

    expect(calculatorTool).toBeDefined();
    expect(calculatorTool.name).toBe('calculator');
  });

  it('should execute a basic agent interaction (requires OPENAI_API_KEY)', async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.includes('your-api-key')) {
      console.log('Skipping agent test - no valid OPENAI_API_KEY found');
      return;
    }

    // Set the API key globally
    setDefaultOpenAIKey(apiKey);

    const funFactTool = tool({
      name: 'fun_fact',
      description: 'Returns a fun fact',
      parameters: z.object({}),
      execute: async () => 'The Eiffel Tower can be 15 cm taller during summer due to thermal expansion.',
    });

    const agent = new Agent({
      name: 'Fun Fact Agent',
      instructions: 'You share fun facts when asked. Use the fun_fact tool to get a fact.',
      tools: [funFactTool],
      model: 'gpt-4.1-mini',
    });

    // Run a simple query
    const response = await run(agent, 'Tell me a fun fact', {
      stream: false,
    });

    expect(response).toBeDefined();
    expect(response.finalOutput).toBeDefined();
    console.log('✅ Agent execution successful:', response.finalOutput);
  }, 20000); // 20s timeout for agent execution
});

