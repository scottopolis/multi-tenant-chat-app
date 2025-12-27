import type { TenantConfig } from './types';

/**
 * Tenant Configuration Storage
 * 
 * MVP: Hardcoded configs for testing
 * Production: Fetch from database (D1, Convex, etc.)
 * 
 * This is where you'd store:
 * - Each tenant's Langfuse keys (if they provide their own)
 * - MCP server configurations
 * - Model preferences
 * - Other tenant-specific settings
 */

/**
 * Environment bindings for tenant config
 * Includes DB binding for production use
 */
export interface TenantConfigEnv {
  DB?: D1Database; // D1 database binding (production)
  // Add other bindings as needed (KV, Durable Objects, etc.)
}

/**
 * In-memory cache for tenant configs
 * Reduces DB queries in production
 */
const configCache = new Map<string, { config: TenantConfig; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// MVP: Hardcoded tenant configurations
// TODO: Replace with database queries
const TENANT_CONFIGS: Record<string, TenantConfig> = {
  /**
   * Default tenant - uses platform Langfuse credentials
   * Langfuse config is undefined, so it falls back to platform env vars
   */
  'default': {
    tenantId: 'default',
    name: 'Default Organization',
    // No langfuse config = uses platform credentials from .dev.vars
    model: 'gpt-4.1-mini',
    langfuse: {
        publicKey: 'pk-lf-484a26a9-19d2-4b0c-be61-42821f6fca56',
        secretKey: 'sk-lf-f75218f3-7d55-45ec-ab41-4d9a9c927a2a',
        host: 'https://us.cloud.langfuse.com',
        promptName: 'pirate', // Their custom prompt
      },
  },
  
  /**
   * Example: Tenant with their own Langfuse account
   * They manage their own prompts in their Langfuse project
   */
  'tenant-1': {
    tenantId: 'tenant-1',
    name: 'Acme Corp',
    langfuse: {
      publicKey: 'pk-lf-484a26a9-19d2-4b0c-be61-42821f6fca56',
      secretKey: 'sk-lf-f75218f3-7d55-45ec-ab41-4d9a9c927a2a',
      host: 'https://us.cloud.langfuse.com',
      promptName: 'customer-support', // Their custom prompt
    },
    model: 'gpt-4.1-mini',
    // Future: MCP server configuration
    // mcpServer: {
    //   url: 'https://mcp.acme.com/api',
    //   authHeader: 'Bearer acme-secret-key',
    //   transport: 'http',
    // },
  },
  
  /**
   * Example: Tenant using platform Langfuse with custom prompt
   * Uses platform credentials but references a specific prompt
   */
  'tenant-2': {
    tenantId: 'tenant-2',
    name: 'Contoso Ltd',
    langfuse: {
      // These would be the platform's keys in production
      // or you could omit this entirely and use platform default
      publicKey: 'PLATFORM_KEY', // Special marker to use platform keys
      secretKey: 'PLATFORM_KEY',
      promptName: 'sales-assistant',
      label: 'tenant-2', // Use labeled version in platform's Langfuse
    },
    model: 'claude-3.5-sonnet',
  },
  
  /**
   * Example: Tenant with systemPrompt (no Langfuse)
   * Langfuse is optional - can use hardcoded systemPrompt instead
   */
  'tenant-3': {
    tenantId: 'tenant-3',
    name: 'Simple Bot Inc',
    systemPrompt: `You are a helpful shopping assistant for Simple Bot Inc. 
    
You help customers find products, answer questions about availability, and provide recommendations.

Be friendly, concise, and always try to upsell related products when appropriate.

If asked about orders or shipping, politely inform the customer to contact support directly.`,
    model: 'gpt-4.1-mini',
    // No Langfuse config - uses systemPrompt instead
  },
};

/**
 * Get tenant configuration
 * 
 * @param tenantId - Tenant/org identifier
 * @param env - Optional environment bindings (for DB access in production)
 * @returns Tenant configuration or default config if not found
 * 
 * @example MVP (current)
 * const config = await getTenantConfig('tenant-1');
 * 
 * @example Production (with DB)
 * const config = await getTenantConfig('tenant-1', { DB: env.DB });
 */
export async function getTenantConfig(
  tenantId: string,
  env?: TenantConfigEnv
): Promise<TenantConfig> {
  // Check cache first
  const cached = configCache.get(tenantId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.config;
  }

  let config: TenantConfig;

  // Production: Fetch from database if DB binding exists
  if (env?.DB) {
    try {
      config = await fetchFromDatabase(tenantId, env.DB);
      console.log(`[TenantConfig] Loaded from DB: ${tenantId}`);
    } catch (error) {
      console.error(`[TenantConfig] DB fetch failed for ${tenantId}:`, error);
      config = TENANT_CONFIGS[tenantId] || TENANT_CONFIGS['default'];
    }
  } else {
    // MVP: Use hardcoded configs
    config = TENANT_CONFIGS[tenantId] || TENANT_CONFIGS['default'];
    console.log(`[TenantConfig] Loaded from memory: ${tenantId}`);
  }

  // Cache the config
  configCache.set(tenantId, { config, timestamp: Date.now() });

  return config;
}

/**
 * Fetch tenant config from D1 database
 * 
 * @internal
 */
async function fetchFromDatabase(
  tenantId: string,
  db: D1Database
): Promise<TenantConfig> {
  const result = await db
    .prepare(
      `SELECT 
        tenant_id,
        name,
        system_prompt,
        langfuse_public_key,
        langfuse_secret_key,
        langfuse_host,
        langfuse_prompt_name,
        langfuse_label,
        model
      FROM tenant_configs 
      WHERE tenant_id = ?`
    )
    .bind(tenantId)
    .first();

  if (!result) {
    return TENANT_CONFIGS['default'];
  }

  // Parse DB result into TenantConfig
  return {
    tenantId: result.tenant_id as string,
    name: result.name as string | undefined,
    systemPrompt: result.system_prompt as string | undefined,
    langfuse: result.langfuse_public_key
      ? {
          publicKey: result.langfuse_public_key as string,
          secretKey: result.langfuse_secret_key as string, // TODO: Decrypt!
          host: result.langfuse_host as string | undefined,
          promptName: result.langfuse_prompt_name as string | undefined,
          label: result.langfuse_label as string | undefined,
        }
      : undefined,
    model: result.model as string | undefined,
  };
}

/**
 * Invalidate cached config for a tenant
 * Call this when tenant config is updated
 * 
 * @param tenantId - Tenant ID to invalidate, or undefined to clear all
 */
export function invalidateTenantCache(tenantId?: string): void {
  if (tenantId) {
    configCache.delete(tenantId);
    console.log(`[TenantConfig] Invalidated cache for: ${tenantId}`);
  } else {
    configCache.clear();
    console.log(`[TenantConfig] Cleared all cache`);
  }
}

/**
 * List all configured tenants (for testing/debugging)
 * In production, this would query the database
 */
export async function listTenants(env?: TenantConfigEnv): Promise<string[]> {
  if (env?.DB) {
    try {
      const result = await env.DB.prepare(
        'SELECT tenant_id FROM tenant_configs ORDER BY tenant_id'
      ).all();
      return result.results.map((row: any) => row.tenant_id as string);
    } catch (error) {
      console.error('[TenantConfig] Failed to list tenants from DB:', error);
    }
  }
  return Object.keys(TENANT_CONFIGS);
}

/**
 * Check if a tenant exists
 */
export async function tenantExists(
  tenantId: string,
  env?: TenantConfigEnv
): Promise<boolean> {
  if (env?.DB) {
    try {
      const result = await env.DB.prepare(
        'SELECT 1 FROM tenant_configs WHERE tenant_id = ?'
      )
        .bind(tenantId)
        .first();
      return !!result;
    } catch (error) {
      console.error('[TenantConfig] Failed to check tenant existence:', error);
    }
  }
  return tenantId in TENANT_CONFIGS;
}

