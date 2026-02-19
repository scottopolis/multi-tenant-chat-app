/**
 * MCP (Model Context Protocol) Integration
 * 
 * Re-exports all MCP-related functionality
 */

// Client: Connect to external MCP servers
export { getMCPTools, getMCPToolsTanStack, readMCPResource } from './client';
export type { MCPClientConfig } from './client';
