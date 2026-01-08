import { createOpenaiChat } from '@tanstack/ai-openai';

export function createOpenRouterChat(apiKey: string) {
  return createOpenaiChat({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });
}
