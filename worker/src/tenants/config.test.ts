import { describe, it, expect } from 'vitest';
import { getAgentConfig, invalidateAgentCache } from './config';

/**
 * Agent Configuration Tests
 * 
 * Tests for the agent configuration system.
 * Configs are now fetched from Convex, so we test the fallback behavior
 * when CONVEX_URL is not set.
 */

describe('Agent Configuration', () => {
  describe('Fallback behavior', () => {
    it('should return fallback config when CONVEX_URL is not set', async () => {
      const config = await getAgentConfig('test-agent');
      
      expect(config).toBeDefined();
      expect(config.agentId).toBe('test-agent');
      expect(config.name).toBe('Default Assistant');
      expect(config.model).toBe('gpt-4.1-mini');
      expect(config.orgId).toBe('unknown');
    });

    it('should preserve agentId in fallback config', async () => {
      const config = await getAgentConfig('my-custom-agent');
      
      expect(config.agentId).toBe('my-custom-agent');
    });

    it('should not have outputSchema in fallback config', async () => {
      const config = await getAgentConfig('calendar-extractor');
      
      expect(config).toBeDefined();
      expect(config.agentId).toBe('calendar-extractor');
      expect(config.outputSchema).toBeUndefined();
    });
  });

  describe('Cache behavior', () => {
    it('should cache config after first fetch', async () => {
      invalidateAgentCache('cache-test-agent');
      
      const config1 = await getAgentConfig('cache-test-agent');
      const config2 = await getAgentConfig('cache-test-agent');
      
      expect(config1).toEqual(config2);
    });

    it('should invalidate cache for specific agent', async () => {
      await getAgentConfig('agent-to-invalidate');
      invalidateAgentCache('agent-to-invalidate');
      
      const config = await getAgentConfig('agent-to-invalidate');
      expect(config).toBeDefined();
    });

    it('should clear all cache when no agentId provided', async () => {
      await getAgentConfig('agent-1');
      await getAgentConfig('agent-2');
      
      invalidateAgentCache();
      
      const config1 = await getAgentConfig('agent-1');
      const config2 = await getAgentConfig('agent-2');
      
      expect(config1).toBeDefined();
      expect(config2).toBeDefined();
    });
  });
});
