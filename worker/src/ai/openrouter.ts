import { createOpenAIChat } from '@tanstack/ai-openai';

export function createOpenRouterChat(apiKey: string) {
  return createOpenAIChat({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
  });
}
