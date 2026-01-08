import { createOpenaiChat } from '@tanstack/ai-openai';

export function createOpenRouterAdapter(model: string, apiKey: string) {
  return createOpenaiChat(model, apiKey, {
    baseURL: 'https://openrouter.ai/api/v1',
  });
}
