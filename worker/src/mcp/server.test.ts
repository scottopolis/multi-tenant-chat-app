import { describe, it, expect } from 'vitest';
import { handleMCPRequest, isValidJSONRPCRequest } from './server';
import { tool } from 'ai';
import { z } from 'zod';

// Mock tools for testing
const mockTools = {
  calculator: tool({
    description: 'Perform basic arithmetic operations',
    parameters: z.object({
      operation: z.enum(['add', 'subtract']),
      a: z.number(),
      b: z.number(),
    }),
    execute: async ({ operation, a, b }) => {
      if (operation === 'add') return { result: a + b };
      return { result: a - b };
    },
  }),
  echo: tool({
    description: 'Echo back the input',
    parameters: z.object({
      message: z.string(),
    }),
    execute: async ({ message }) => `Echo: ${message}`,
  }),
};

describe('MCP Server', () => {
  it('should list available tools', async () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 1,
      method: 'tools/list',
      params: {},
    };

    const response = await handleMCPRequest(request, mockTools);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(1);
    expect(response.result).toBeDefined();
    expect(response.result.tools).toHaveLength(2);
    expect(response.result.tools[0].name).toBe('calculator');
    expect(response.result.tools[1].name).toBe('echo');
  });

  it('should execute a tool successfully', async () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 2,
      method: 'tools/call',
      params: {
        name: 'calculator',
        arguments: { operation: 'add', a: 5, b: 3 },
      },
    };

    const response = await handleMCPRequest(request, mockTools);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(2);
    expect(response.result).toBeDefined();
    expect(response.result.content[0].type).toBe('text');
    expect(response.result.content[0].text).toContain('"result": 8');
  });

  it('should return error for unknown method', async () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 3,
      method: 'unknown/method',
      params: {},
    };

    const response = await handleMCPRequest(request, mockTools);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(3);
    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(-32601);
    expect(response.error!.message).toContain('Method not found');
  });

  it('should return error for non-existent tool', async () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 4,
      method: 'tools/call',
      params: {
        name: 'nonexistent',
        arguments: {},
      },
    };

    const response = await handleMCPRequest(request, mockTools);

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(4);
    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(-32602);
    expect(response.error!.message).toContain('Tool not found');
  });

  it('should validate JSON-RPC request format', () => {
    const validRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    };

    const invalidRequest1 = {
      jsonrpc: '1.0',
      id: 1,
      method: 'tools/list',
    };

    const invalidRequest2 = {
      jsonrpc: '2.0',
      method: 'tools/list',
    };

    expect(isValidJSONRPCRequest(validRequest)).toBe(true);
    expect(isValidJSONRPCRequest(invalidRequest1)).toBe(false);
    expect(isValidJSONRPCRequest(invalidRequest2)).toBe(false);
  });
});

