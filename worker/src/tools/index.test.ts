import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTools } from './index';
import * as mcpModule from '../mcp';
import * as tenantModule from '../tenants/config';
import type { TenantConfig } from '../tenants/types';

/**
 * Tools unit tests - testing multiple MCP server integration
 * Focus: Tool aggregation from multiple sources (built-in + multiple MCP servers)
 */

// Mock MCP client
vi.mock('../mcp', () => ({
  getMCPTools: vi.fn(),
}));

// Mock tenant config
vi.mock('../tenants/config', () => ({
  getTenantConfig: vi.fn(),
}));

describe('Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTools with single MCP server', () => {
    it('should return built-in tools plus MCP tools from one server', async () => {
      // Mock tenant config with one MCP server
      const mockConfig: TenantConfig = {
        tenantId: 'test-tenant',
        mcpServers: [
          {
            url: 'http://localhost:3001',
            transport: 'http',
          },
        ],
      };
      vi.mocked(tenantModule.getTenantConfig).mockResolvedValue(mockConfig);

      // Mock MCP tools from server
      const mockMCPTools = {
        customTool1: {
          description: 'Custom tool 1',
          parameters: {},
          execute: async () => 'result1',
        },
      };
      vi.mocked(mcpModule.getMCPTools).mockResolvedValue(mockMCPTools);

      // Get tools
      const tools = await getTools('test-tenant');

      // Should include built-in tools
      expect(tools.currentTime).toBeDefined();
      expect(tools.calculator).toBeDefined();

      // Should include MCP tool
      expect(tools.customTool1).toBeDefined();
      expect(tools.customTool1.description).toBe('Custom tool 1');

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
      // Mock tenant config with multiple MCP servers
      const mockConfig: TenantConfig = {
        tenantId: 'test-tenant',
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
      vi.mocked(tenantModule.getTenantConfig).mockResolvedValue(mockConfig);

      // Mock tools from first MCP server
      const mockMCPTools1 = {
        serverOneTool: {
          description: 'Tool from server 1',
          parameters: {},
          execute: async () => 'result1',
        },
      };

      // Mock tools from second MCP server
      const mockMCPTools2 = {
        serverTwoTool: {
          description: 'Tool from server 2',
          parameters: {},
          execute: async () => 'result2',
        },
      };

      // Mock getMCPTools to return different tools for each server
      vi.mocked(mcpModule.getMCPTools)
        .mockResolvedValueOnce(mockMCPTools1)
        .mockResolvedValueOnce(mockMCPTools2);

      // Get tools
      const tools = await getTools('test-tenant');

      // Should include built-in tools
      expect(tools.currentTime).toBeDefined();
      expect(tools.calculator).toBeDefined();

      // Should include tools from both MCP servers
      expect(tools.serverOneTool).toBeDefined();
      expect(tools.serverOneTool.description).toBe('Tool from server 1');
      expect(tools.serverTwoTool).toBeDefined();
      expect(tools.serverTwoTool.description).toBe('Tool from server 2');

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

    it('should handle tool name conflicts (later server overrides earlier)', async () => {
      // Mock tenant config with multiple MCP servers
      const mockConfig: TenantConfig = {
        tenantId: 'test-tenant',
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
      vi.mocked(tenantModule.getTenantConfig).mockResolvedValue(mockConfig);

      // Both servers provide a tool with the same name
      const mockMCPTools1 = {
        conflictingTool: {
          description: 'Tool from server 1',
          parameters: {},
          execute: async () => 'server1',
        },
      };

      const mockMCPTools2 = {
        conflictingTool: {
          description: 'Tool from server 2 (should win)',
          parameters: {},
          execute: async () => 'server2',
        },
      };

      vi.mocked(mcpModule.getMCPTools)
        .mockResolvedValueOnce(mockMCPTools1)
        .mockResolvedValueOnce(mockMCPTools2);

      // Get tools
      const tools = await getTools('test-tenant');

      // Later server (server 2) should override earlier one
      expect(tools.conflictingTool).toBeDefined();
      expect(tools.conflictingTool.description).toBe('Tool from server 2 (should win)');
      const result = await tools.conflictingTool.execute();
      expect(result).toBe('server2');
    });

    it('should continue if one MCP server fails', async () => {
      // Mock tenant config with multiple MCP servers
      const mockConfig: TenantConfig = {
        tenantId: 'test-tenant',
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
      vi.mocked(tenantModule.getTenantConfig).mockResolvedValue(mockConfig);

      // Server 1 succeeds
      const mockMCPTools1 = {
        tool1: {
          description: 'Tool 1',
          parameters: {},
          execute: async () => 'result1',
        },
      };

      // Server 2 fails
      // Server 3 succeeds
      const mockMCPTools3 = {
        tool3: {
          description: 'Tool 3',
          parameters: {},
          execute: async () => 'result3',
        },
      };

      vi.mocked(mcpModule.getMCPTools)
        .mockResolvedValueOnce(mockMCPTools1)
        .mockRejectedValueOnce(new Error('Server 2 connection failed'))
        .mockResolvedValueOnce(mockMCPTools3);

      // Get tools
      const tools = await getTools('test-tenant');

      // Should include built-in tools
      expect(tools.currentTime).toBeDefined();

      // Should include tools from server 1 and 3, but not 2
      expect(tools.tool1).toBeDefined();
      expect(tools.tool3).toBeDefined();

      // Verify all three servers were attempted
      expect(mcpModule.getMCPTools).toHaveBeenCalledTimes(3);
    });
  });

  describe('getTools with no MCP servers', () => {
    it('should return only built-in tools when no MCP servers configured', async () => {
      // Mock tenant config without MCP servers
      const mockConfig: TenantConfig = {
        tenantId: 'test-tenant',
        // No mcpServers configured
      };
      vi.mocked(tenantModule.getTenantConfig).mockResolvedValue(mockConfig);

      // Get tools
      const tools = await getTools('test-tenant');

      // Should include built-in tools
      expect(tools.currentTime).toBeDefined();
      expect(tools.calculator).toBeDefined();

      // MCP client should not be called
      expect(mcpModule.getMCPTools).not.toHaveBeenCalled();
    });

    it('should return only built-in tools when mcpServers is empty array', async () => {
      // Mock tenant config with empty MCP servers array
      const mockConfig: TenantConfig = {
        tenantId: 'test-tenant',
        mcpServers: [],
      };
      vi.mocked(tenantModule.getTenantConfig).mockResolvedValue(mockConfig);

      // Get tools
      const tools = await getTools('test-tenant');

      // Should include built-in tools
      expect(tools.currentTime).toBeDefined();
      expect(tools.calculator).toBeDefined();

      // MCP client should not be called
      expect(mcpModule.getMCPTools).not.toHaveBeenCalled();
    });
  });

  describe('getTools with invalid MCP server config', () => {
    it('should skip MCP server with missing URL', async () => {
      // Mock tenant config with invalid MCP server (missing URL)
      const mockConfig: TenantConfig = {
        tenantId: 'test-tenant',
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
      vi.mocked(tenantModule.getTenantConfig).mockResolvedValue(mockConfig);

      const mockMCPTools2 = {
        validTool: {
          description: 'Tool from valid server',
          parameters: {},
          execute: async () => 'result',
        },
      };

      vi.mocked(mcpModule.getMCPTools).mockResolvedValue(mockMCPTools2);

      // Get tools
      const tools = await getTools('test-tenant');

      // Should have built-in tools and tools from valid server
      expect(tools.currentTime).toBeDefined();
      expect(tools.validTool).toBeDefined();

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

