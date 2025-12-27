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
 * Fetch a prompt from Langfuse
 * 
 * If a label is provided, fetches the labeled version.
 * If no label is provided, fetches the default/production version.
 * Falls back to default prompt if:
 * - Prompt doesn't exist
 * - Langfuse API call fails
 * - No prompt found with the given name
 * 
 * @param langfuse - Langfuse client instance
 * @param promptName - Name of the prompt in Langfuse (defaults to 'base-assistant')
 * @param label - Optional label to fetch specific version
 * @returns System prompt string
 * 
 * @example
 * // Fetch default/production version
 * const prompt = await getPromptByTenant(langfuse, 'pirate');
 * 
 * // Fetch labeled version for specific tenant
 * const prompt = await getPromptByTenant(langfuse, 'base-assistant', 'tenant-1');
 */
export async function getPromptByTenant(
  langfuse: Langfuse,
  promptName: string = 'base-assistant',
  label?: string
): Promise<string> {
  try {
    // Fetch prompt with or without label
    const prompt = label 
      ? await langfuse.getPrompt(promptName, undefined, { label })
      : await langfuse.getPrompt(promptName);
    
    // Extract prompt content (could be string or object)
    if (typeof prompt.prompt === 'string') {
      return prompt.prompt;
    } else if (prompt.prompt && typeof prompt.prompt === 'object') {
      // Handle structured prompts (e.g., ChatML format)
      return JSON.stringify(prompt.prompt);
    }
    
    const labelInfo = label ? ` with label '${label}'` : '';
    console.warn(`Prompt ${promptName}${labelInfo} returned unexpected format`);
    return 'You are a helpful AI assistant.';
  } catch (error) {
    // Log error but don't fail the request
    const labelInfo = label ? ` with label '${label}'` : '';
    console.error(`Failed to fetch prompt ${promptName}${labelInfo}:`, error);
    
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

