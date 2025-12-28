import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTools } from './index';
import * as mcpModule from '../mcp';
import * as agentModule from '../tenants/config';
import type { AgentConfig } from '../tenants/types';

/**
 * Tools unit tests - testing multiple MCP server integration
 * Focus: Tool aggregation from multiple sources (built-in + multiple MCP servers)
 */

// Mock MCP client
vi.mock('../mcp', () => ({
  getMCPTools: vi.fn(),
}));

// Mock agent config
vi.mock('../tenants/config', () => ({
  getAgentConfig: vi.fn(),
}));

describe('Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTools with single MCP server', () => {
    it('should return built-in tools plus MCP tools from one server', async () => {
      // Mock agent config with one MCP server
      const mockConfig: AgentConfig = {
        agentId: 'test-agent',
        orgId: 'test-org',
        mcpServers: [
          {
            url: 'http://localhost:3001',
            transport: 'http',
          },
        ],
      };
      vi.mocked(agentModule.getAgentConfig).mockResolvedValue(mockConfig);

      // Mock MCP tools from server (array format)
      const mockMCPTools = [
        {
          name: 'customTool1',
          description: 'Custom tool 1',
          parameters: {},
          execute: async () => 'result1',
        },
      ];
      vi.mocked(mcpModule.getMCPTools).mockResolvedValue(mockMCPTools);

      // Get tools
      const tools = await getTools('test-agent');

      // Should be an array
      expect(Array.isArray(tools)).toBe(true);
      
      // Should include built-in tools
      const timeToolIndex = tools.findIndex(t => t.name === 'currentTime');
      const calcToolIndex = tools.findIndex(t => t.name === 'calculator');
      expect(timeToolIndex).toBeGreaterThanOrEqual(0);
      expect(calcToolIndex).toBeGreaterThanOrEqual(0);

      // Should include MCP tool
      const customToolIndex = tools.findIndex(t => t.name === 'customTool1');
      expect(customToolIndex).toBeGreaterThanOrEqual(0);
      expect(tools[customToolIndex].description).toBe('Custom tool 1');

      // Verify MCP client was called once with correct config
      expect(mcpModule.getMCPTools).toHaveBeenCalledTimes(1);
      expect(mcpModule.getMCPTools).toHaveBeenCalledWith({
        serverUrl: 'http://localhost:3001',
        authHeader: undefined,
        transport: 'http',
      });
    });
  });

  describe('getTools with multiple MCP servers', () => {
    it('should aggregate tools from multiple MCP servers', async () => {
      // Mock agent config with multiple MCP servers
      const mockConfig: AgentConfig = {
        agentId: 'test-agent',
        orgId: 'test-org',
        mcpServers: [
          {
            url: 'http://localhost:3001',
            transport: 'http',
          },
          {
            url: 'http://localhost:3002',
            authHeader: 'Bearer secret-token',
            transport: 'http',
          },
        ],
      };
      vi.mocked(agentModule.getAgentConfig).mockResolvedValue(mockConfig);

      // Mock tools from first MCP server (array format)
      const mockMCPTools1 = [
        {
          name: 'serverOneTool',
          description: 'Tool from server 1',
          parameters: {},
          execute: async () => 'result1',
        },
      ];

      // Mock tools from second MCP server (array format)
      const mockMCPTools2 = [
        {
          name: 'serverTwoTool',
          description: 'Tool from server 2',
          parameters: {},
          execute: async () => 'result2',
        },
      ];

      // Mock getMCPTools to return different tools for each server
      vi.mocked(mcpModule.getMCPTools)
        .mockResolvedValueOnce(mockMCPTools1)
        .mockResolvedValueOnce(mockMCPTools2);

      // Get tools
      const tools = await getTools('test-agent');

      // Should be an array
      expect(Array.isArray(tools)).toBe(true);
      
      // Should include built-in tools
      expect(tools.some(t => t.name === 'currentTime')).toBe(true);
      expect(tools.some(t => t.name === 'calculator')).toBe(true);

      // Should include tools from both MCP servers
      const serverOneTool = tools.find(t => t.name === 'serverOneTool');
      const serverTwoTool = tools.find(t => t.name === 'serverTwoTool');
      
      expect(serverOneTool).toBeDefined();
      expect(serverOneTool!.description).toBe('Tool from server 1');
      expect(serverTwoTool).toBeDefined();
      expect(serverTwoTool!.description).toBe('Tool from server 2');

      // Verify MCP client was called twice with correct configs
      expect(mcpModule.getMCPTools).toHaveBeenCalledTimes(2);
      expect(mcpModule.getMCPTools).toHaveBeenNthCalledWith(1, {
        serverUrl: 'http://localhost:3001',
        authHeader: undefined,
        transport: 'http',
      });
      expect(mcpModule.getMCPTools).toHaveBeenNthCalledWith(2, {
        serverUrl: 'http://localhost:3002',
        authHeader: 'Bearer secret-token',
        transport: 'http',
      });
    });

    it('should handle tool name conflicts (both tools are present)', async () => {
      // Mock agent config with multiple MCP servers
      const mockConfig: AgentConfig = {
        agentId: 'test-agent',
        orgId: 'test-org',
        mcpServers: [
          {
            url: 'http://localhost:3001',
            transport: 'http',
          },
          {
            url: 'http://localhost:3002',
            transport: 'http',
          },
        ],
      };
      vi.mocked(agentModule.getAgentConfig).mockResolvedValue(mockConfig);

      // Both servers provide a tool with the same name (array format)
      const mockMCPTools1 = [
        {
          name: 'conflictingTool',
          description: 'Tool from server 1',
          parameters: {},
          execute: async () => 'server1',
        },
      ];

      const mockMCPTools2 = [
        {
          name: 'conflictingTool',
          description: 'Tool from server 2',
          parameters: {},
          execute: async () => 'server2',
        },
      ];

      vi.mocked(mcpModule.getMCPTools)
        .mockResolvedValueOnce(mockMCPTools1)
        .mockResolvedValueOnce(mockMCPTools2);

      // Get tools
      const tools = await getTools('test-agent');

      // Both tools should be present (array allows duplicates)
      const conflictingTools = tools.filter(t => t.name === 'conflictingTool');
      expect(conflictingTools.length).toBe(2);
      expect(conflictingTools[0].description).toBe('Tool from server 1');
      expect(conflictingTools[1].description).toBe('Tool from server 2');
    });

    it('should continue if one MCP server fails', async () => {
      // Mock agent config with multiple MCP servers
      const mockConfig: AgentConfig = {
        agentId: 'test-agent',
        orgId: 'test-org',
        mcpServers: [
          {
            url: 'http://localhost:3001',
            transport: 'http',
          },
          {
            url: 'http://localhost:3002', // This one will fail
            transport: 'http',
          },
          {
            url: 'http://localhost:3003',
            transport: 'http',
          },
        ],
      };
      vi.mocked(agentModule.getAgentConfig).mockResolvedValue(mockConfig);

      // Server 1 succeeds (array format)
      const mockMCPTools1 = [
        {
          name: 'tool1',
          description: 'Tool 1',
          parameters: {},
          execute: async () => 'result1',
        },
      ];

      // Server 2 fails
      // Server 3 succeeds (array format)
      const mockMCPTools3 = [
        {
          name: 'tool3',
          description: 'Tool 3',
          parameters: {},
          execute: async () => 'result3',
        },
      ];

      vi.mocked(mcpModule.getMCPTools)
        .mockResolvedValueOnce(mockMCPTools1)
        .mockRejectedValueOnce(new Error('Server 2 connection failed'))
        .mockResolvedValueOnce(mockMCPTools3);

      // Get tools
      const tools = await getTools('test-agent');

      // Should include built-in tools
      expect(tools.some(t => t.name === 'currentTime')).toBe(true);

      // Should include tools from server 1 and 3, but not 2
      expect(tools.some(t => t.name === 'tool1')).toBe(true);
      expect(tools.some(t => t.name === 'tool3')).toBe(true);

      // Verify all three servers were attempted
      expect(mcpModule.getMCPTools).toHaveBeenCalledTimes(3);
    });
  });

  describe('getTools with no MCP servers', () => {
    it('should return only built-in tools when no MCP servers configured', async () => {
      // Mock agent config without MCP servers
      const mockConfig: AgentConfig = {
        agentId: 'test-agent',
        orgId: 'test-org',
        // No mcpServers configured
      };
      vi.mocked(agentModule.getAgentConfig).mockResolvedValue(mockConfig);

      // Get tools
      const tools = await getTools('test-agent');

      // Should be an array
      expect(Array.isArray(tools)).toBe(true);
      
      // Should include built-in tools
      expect(tools.some(t => t.name === 'currentTime')).toBe(true);
      expect(tools.some(t => t.name === 'calculator')).toBe(true);

      // MCP client should not be called
      expect(mcpModule.getMCPTools).not.toHaveBeenCalled();
    });

    it('should return only built-in tools when mcpServers is empty array', async () => {
      // Mock agent config with empty MCP servers array
      const mockConfig: AgentConfig = {
        agentId: 'test-agent',
        orgId: 'test-org',
        mcpServers: [],
      };
      vi.mocked(agentModule.getAgentConfig).mockResolvedValue(mockConfig);

      // Get tools
      const tools = await getTools('test-agent');

      // Should be an array
      expect(Array.isArray(tools)).toBe(true);
      
      // Should include built-in tools
      expect(tools.some(t => t.name === 'currentTime')).toBe(true);
      expect(tools.some(t => t.name === 'calculator')).toBe(true);

      // MCP client should not be called
      expect(mcpModule.getMCPTools).not.toHaveBeenCalled();
    });
  });

  describe('getTools with invalid MCP server config', () => {
    it('should skip MCP server with missing URL', async () => {
      // Mock agent config with invalid MCP server (missing URL)
      const mockConfig: AgentConfig = {
        agentId: 'test-agent',
        orgId: 'test-org',
        mcpServers: [
          {
            url: '', // Invalid: empty URL
            transport: 'http',
          },
          {
            url: 'http://localhost:3002', // Valid
            transport: 'http',
          },
        ],
      };
      vi.mocked(agentModule.getAgentConfig).mockResolvedValue(mockConfig);

      const mockMCPTools2 = [
        {
          name: 'validTool',
          description: 'Tool from valid server',
          parameters: {},
          execute: async () => 'result',
        },
      ];

      vi.mocked(mcpModule.getMCPTools).mockResolvedValue(mockMCPTools2);

      // Get tools
      const tools = await getTools('test-agent');

      // Should be an array
      expect(Array.isArray(tools)).toBe(true);
      
      // Should have built-in tools and tools from valid server
      expect(tools.some(t => t.name === 'currentTime')).toBe(true);
      expect(tools.some(t => t.name === 'validTool')).toBe(true);

      // MCP client should only be called once (for the valid server)
      expect(mcpModule.getMCPTools).toHaveBeenCalledTimes(1);
      expect(mcpModule.getMCPTools).toHaveBeenCalledWith({
        serverUrl: 'http://localhost:3002',
        authHeader: undefined,
        transport: 'http',
      });
    });
  });
});

