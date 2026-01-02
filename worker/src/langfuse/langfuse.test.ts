import { describe, it, expect } from 'vitest';
import { getAgentConfig } from '../tenants/config';
import { getLangfuseClient, isLangfuseConfigured } from './index';

/**
 * Langfuse Configuration Tests
 * 
 * These tests validate Langfuse client functionality and configuration detection.
 * Agent configs are now fetched from Convex, so we test the fallback behavior
 * and the Langfuse utility functions rather than specific tenant configs.
 */
describe('Langfuse Configuration', () => {
  describe('Default agent config (fallback)', () => {
    it('should load fallback config when CONVEX_URL is not set', async () => {
      const config = await getAgentConfig('default');
      
      expect(config).toBeDefined();
      expect(config.agentId).toBe('default');
      expect(config.name).toBe('Default Assistant');
      expect(config.model).toBe('gpt-4.1-mini');
    });

    it('should return fallback for any unknown agent', async () => {
      const config = await getAgentConfig('unknown-agent-xyz');
      
      expect(config).toBeDefined();
      expect(config.agentId).toBe('unknown-agent-xyz');
      expect(config.name).toBe('Default Assistant');
    });
  });

  describe('Langfuse configuration detection', () => {
    it('should detect Langfuse as configured when both keys present', () => {
      const env = {
        LANGFUSE_PUBLIC_KEY: 'pk-lf-test',
        LANGFUSE_SECRET_KEY: 'sk-lf-test',
      };
      
      expect(isLangfuseConfigured(env)).toBe(true);
    });

    it('should detect Langfuse as not configured when keys missing', () => {
      expect(isLangfuseConfigured({})).toBe(false);
      expect(isLangfuseConfigured({ LANGFUSE_PUBLIC_KEY: 'test' })).toBe(false);
      expect(isLangfuseConfigured({ LANGFUSE_SECRET_KEY: 'test' })).toBe(false);
    });
  });

  describe('Langfuse client creation', () => {
    it('should create Langfuse client with valid credentials', () => {
      const client = getLangfuseClient({
        publicKey: 'pk-lf-test-key',
        secretKey: 'sk-lf-test-key',
        host: 'https://langfuse.example.com',
      });
      
      expect(client).toBeDefined();
      expect(typeof client).toBe('object');
    });

    it('should cache Langfuse clients for same credentials', () => {
      const credentials = {
        publicKey: 'pk-lf-cache-test',
        secretKey: 'sk-lf-cache-test',
        host: 'https://langfuse.example.com',
      };
      
      const client1 = getLangfuseClient(credentials);
      const client2 = getLangfuseClient(credentials);
      
      // Should return the same cached instance
      expect(client1).toBe(client2);
    });

    it('should create different clients for different credentials', () => {
      const client1 = getLangfuseClient({
        publicKey: 'pk-lf-different-1',
        secretKey: 'sk-lf-different-1',
        host: 'https://langfuse.example.com',
      });
      
      const client2 = getLangfuseClient({
        publicKey: 'pk-lf-different-2',
        secretKey: 'sk-lf-different-2',
        host: 'https://langfuse.example.com',
      });
      
      // Different credentials should create different clients
      expect(client1).not.toBe(client2);
    });
  });
});
