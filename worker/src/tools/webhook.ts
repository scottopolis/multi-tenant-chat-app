import { tool } from '@openai/agents';
import { z } from 'zod';

/**
 * Webhook-based custom tools
 * 
 * These tools allow organizations to define custom functionality by
 * providing a webhook URL that receives the tool parameters and returns
 * the result.
 */

export interface WebhookToolConfig {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  webhookUrl: string;
  headers?: Record<string, string>;
}

/**
 * Create a webhook-based tool
 * 
 * When the tool is called, it will POST to the webhook URL with the parameters
 * and return the response.
 * 
 * TODO: Add webhook signature verification
 * - Generate HMAC signature using org secret
 * - Include signature in X-Webhook-Signature header
 * - Allow webhook to verify authenticity
 * 
 * TODO: Add timeout and retry logic
 * TODO: Add webhook response validation
 */
export function createWebhookTool(config: WebhookToolConfig) {
  return tool({
    name: config.name,
    description: config.description,
    parameters: config.parameters,
    execute: async (params) => {
      try {
        const response = await fetch(config.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...config.headers,
            // TODO: Add signature header
            // 'X-Webhook-Signature': generateSignature(params, orgSecret),
          },
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          throw new Error(`Webhook returned status ${response.status}`);
        }

        const result = await response.json();
        return result;
      } catch (error) {
        console.error(`Webhook tool ${config.name} failed:`, error);
        throw new Error(
          `Failed to execute webhook tool: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    },
  });
}

/**
 * Example webhook tool configuration
 * In production, these would be fetched from org settings
 */
export function getExampleWebhookTool() {
  return createWebhookTool({
    name: 'customAction',
    description: 'Execute a custom action via webhook',
    parameters: z.object({
      action: z.string().describe('The action to perform'),
      data: z.record(z.any()).nullable().optional().describe('Additional data for the action'),
    }),
    webhookUrl: 'https://example.com/webhook',
    headers: {
      'X-API-Key': 'example-key',
    },
  });
}

