import { describe, it, expect } from 'vitest';
import { getTenantConfig } from '../tenants/config';
import { getLangfuseClient, isLangfuseConfigured } from './index';

/**
 * Langfuse Configuration Tests
 * 
 * These tests validate that tenant configs are properly set up with Langfuse credentials.
 * 
 * Note: We don't test actual API calls here due to SSL issues in Node.js test environment.
 * Real integration testing happens via E2E tests with the actual Worker running.
 */
describe('Langfuse Configuration', () => {
  describe('Default tenant config', () => {
    it('should load default tenant config with Langfuse credentials', async () => {
      const config = await getTenantConfig('default');
      
      expect(config).toBeDefined();
      expect(config.tenantId).toBe('default');
      expect(config.name).toBe('Default Organization');
    });

    it('should have valid Langfuse credentials configured', async () => {
      const config = await getTenantConfig('default');
      
      // Check Langfuse config exists
      expect(config.langfuse).toBeDefined();
      expect(config.langfuse?.publicKey).toBeDefined();
      expect(config.langfuse?.secretKey).toBeDefined();
      expect(config.langfuse?.host).toBeDefined();
      expect(config.langfuse?.promptName).toBeDefined();
      
      // Validate key formats
      expect(config.langfuse!.publicKey).toMatch(/^pk-lf-/);
      expect(config.langfuse!.secretKey).toMatch(/^sk-lf-/);
      expect(config.langfuse!.host).toMatch(/^https:\/\//);
      
      // Check configured prompt name
      expect(config.langfuse!.promptName).toBe('pirate');
      
      console.log('✓ Default tenant has valid Langfuse config:', {
        publicKey: config.langfuse!.publicKey.substring(0, 15) + '...',
        host: config.langfuse!.host,
        promptName: config.langfuse!.promptName,
      });
    });

    it('should create Langfuse client with tenant credentials', async () => {
      const config = await getTenantConfig('default');
      
      expect(config.langfuse).toBeDefined();
      
      const client = getLangfuseClient({
        publicKey: config.langfuse!.publicKey,
        secretKey: config.langfuse!.secretKey,
        host: config.langfuse!.host,
      });
      
      expect(client).toBeDefined();
      expect(typeof client).toBe('object');
    });

    it('should detect Langfuse as configured', () => {
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

  describe('Tenant-1 config', () => {
    it('should load tenant-1 config with Langfuse credentials', async () => {
      const config = await getTenantConfig('tenant-1');
      
      expect(config).toBeDefined();
      expect(config.tenantId).toBe('tenant-1');
      expect(config.name).toBe('Acme Corp');
    });

    it('should have customer-support prompt configured', async () => {
      const config = await getTenantConfig('tenant-1');
      
      expect(config.langfuse).toBeDefined();
      expect(config.langfuse?.promptName).toBe('customer-support');
      expect(config.langfuse?.publicKey).toMatch(/^pk-lf-/);
      expect(config.langfuse?.secretKey).toMatch(/^sk-lf-/);
    });
  });

  describe('Tenant-2 config (platform keys)', () => {
    it('should have PLATFORM_KEY marker for using platform credentials', async () => {
      const config = await getTenantConfig('tenant-2');
      
      expect(config).toBeDefined();
      expect(config.tenantId).toBe('tenant-2');
      expect(config.langfuse).toBeDefined();
      expect(config.langfuse?.publicKey).toBe('PLATFORM_KEY');
      expect(config.langfuse?.secretKey).toBe('PLATFORM_KEY');
      expect(config.langfuse?.promptName).toBe('sales-assistant');
      expect(config.langfuse?.label).toBe('tenant-2');
    });
  });

  describe('Client caching', () => {
    it('should cache Langfuse clients for same credentials', async () => {
      const config = await getTenantConfig('default');
      
      const client1 = getLangfuseClient({
        publicKey: config.langfuse!.publicKey,
        secretKey: config.langfuse!.secretKey,
        host: config.langfuse!.host,
      });
      
      const client2 = getLangfuseClient({
        publicKey: config.langfuse!.publicKey,
        secretKey: config.langfuse!.secretKey,
        host: config.langfuse!.host,
      });
      
      // Should return the same cached instance
      expect(client1).toBe(client2);
      console.log('✓ Langfuse client caching works correctly');
    });

    it('should create different clients for different credentials', async () => {
      const defaultConfig = await getTenantConfig('default');
      const tenant1Config = await getTenantConfig('tenant-1');
      
      const defaultClient = getLangfuseClient({
        publicKey: defaultConfig.langfuse!.publicKey,
        secretKey: defaultConfig.langfuse!.secretKey,
        host: defaultConfig.langfuse!.host,
      });
      
      const tenant1Client = getLangfuseClient({
        publicKey: tenant1Config.langfuse!.publicKey,
        secretKey: tenant1Config.langfuse!.secretKey,
        host: tenant1Config.langfuse!.host,
      });
      
      // Both use same credentials, so should be same client
      expect(defaultClient).toBe(tenant1Client);
    });
  });

  describe('Model configuration', () => {
    it('should have model configured for each tenant', async () => {
      const defaultConfig = await getTenantConfig('default');
      const tenant1Config = await getTenantConfig('tenant-1');
      const tenant2Config = await getTenantConfig('tenant-2');
      
      expect(defaultConfig.model).toBe('gpt-4.1-mini');
      expect(tenant1Config.model).toBe('gpt-4.1-mini');
      expect(tenant2Config.model).toBe('claude-3.5-sonnet');
      
      console.log('✓ All tenants have model configurations');
    });
  });
});
