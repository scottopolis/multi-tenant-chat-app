import { Langfuse } from 'langfuse';

/**
 * Langfuse client cache
 * Keyed by a hash of credentials to support multiple tenants
 */
const langfuseClients = new Map<string, Langfuse>();

/**
 * Get or create a Langfuse client instance
 * 
 * Supports both:
 * - Platform-wide credentials (from env vars)
 * - Per-tenant credentials (from tenant config)
 * 
 * Caches clients to avoid repeated initialization
 * 
 * @param credentials - Langfuse credentials
 * @returns Langfuse client instance
 */
export function getLangfuseClient(credentials: {
  publicKey: string;
  secretKey: string;
  host?: string;
}): Langfuse {
  const { publicKey, secretKey, host = 'https://cloud.langfuse.com' } = credentials;
  
  // Create cache key from credentials
  const cacheKey = `${publicKey}:${host}`;
  
  // Return cached client if exists
  if (langfuseClients.has(cacheKey)) {
    return langfuseClients.get(cacheKey)!;
  }
  
  // Create new client
  const client = new Langfuse({
    publicKey,
    secretKey,
    baseUrl: host,
  });
  
  // Cache it
  langfuseClients.set(cacheKey, client);
  
  return client;
}

/**
 * Fetch a tenant-specific prompt from Langfuse
 * 
 * Uses the tenant ID as a label to fetch tenant-specific prompt versions.
 * Falls back to default prompt if:
 * - Tenant-specific version doesn't exist
 * - Langfuse API call fails
 * - No prompt found with the given name
 * 
 * @param langfuse - Langfuse client instance
 * @param tenantId - Tenant/org ID (used as label)
 * @param promptName - Name of the prompt in Langfuse (defaults to 'base-assistant')
 * @returns System prompt string
 * 
 * @example
 * // Fetch prompt for tenant-1
 * const prompt = await getPromptByTenant(langfuse, 'tenant-1', 'base-assistant');
 * 
 * // In Langfuse, create a prompt named "base-assistant" with:
 * // - Production version (default)
 * // - Label "tenant-1" for tenant-specific version
 */
export async function getPromptByTenant(
  langfuse: Langfuse,
  tenantId: string,
  promptName: string = 'base-assistant'
): Promise<string> {
  try {
    // Try to get tenant-specific prompt version using label
    const prompt = await langfuse.getPrompt(promptName, undefined, {
      label: tenantId,
    });
    
    // Extract prompt content (could be string or object)
    if (typeof prompt.prompt === 'string') {
      return prompt.prompt;
    } else if (prompt.prompt && typeof prompt.prompt === 'object') {
      // Handle structured prompts (e.g., ChatML format)
      return JSON.stringify(prompt.prompt);
    }
    
    console.warn(`Prompt ${promptName} for tenant ${tenantId} returned unexpected format`);
    return 'You are a helpful AI assistant.';
  } catch (error) {
    // Log error but don't fail the request
    console.error(`Failed to fetch prompt for tenant ${tenantId}:`, error);
    
    // Fallback to default prompt
    return 'You are a helpful AI assistant.';
  }
}

/**
 * Check if Langfuse is configured
 * 
 * @param env - Environment variables
 * @returns true if Langfuse credentials are present
 */
export function isLangfuseConfigured(env: {
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_SECRET_KEY?: string;
}): boolean {
  return !!(env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY);
}

