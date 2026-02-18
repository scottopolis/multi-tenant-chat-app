/**
 * MCP (Model Context Protocol) Integration
 * 
 * Re-exports all MCP-related functionality
 */

// Client: Connect to external MCP servers
export { getMCPTools, readMCPResource } from './client';
export type { MCPClientConfig } from './client';

