import { tool } from '@openai/agents';
import { z } from 'zod';

/**
 * Creates a function-based vector store search tool.
 * 
 * Unlike the hosted `fileSearchTool`, this is a function tool that can be used
 * with RealtimeAgent (voice agents). It queries OpenAI's Vector Store API directly.
 * 
 * @param vectorStoreId - The OpenAI Vector Store ID to search
 * @param apiKey - OpenAI API key for authentication
 * @returns A function tool compatible with RealtimeAgent
 */
export function createVectorSearchTool(vectorStoreId: string, apiKey: string) {
  return tool({
    name: 'search_knowledge_base',
    description: 'Search the knowledge base for information relevant to the user\'s question. Use this when users ask about topics that might be covered in documentation, guides, or other uploaded materials.',
    parameters: z.object({
      query: z.string().describe('The search query to find relevant information'),
    }),
    execute: async ({ query }) => {
      console.log(`[search_knowledge_base] Searching vector store ${vectorStoreId} for: ${query}`);
      
      try {
        const response = await fetch(
          `https://api.openai.com/v1/vector_stores/${vectorStoreId}/search`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'OpenAI-Beta': 'assistants=v2',
            },
            body: JSON.stringify({
              query,
              max_num_results: 5,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error(`[search_knowledge_base] API error: ${response.status} ${error}`);
          return `Unable to search the knowledge base at this time. Please try again.`;
        }

        const data = await response.json() as {
          data: Array<{
            content: Array<{ text: string; type: string }>;
            score: number;
            file_id: string;
          }>;
        };

        if (!data.data || data.data.length === 0) {
          return 'No relevant information found in the knowledge base for that query.';
        }

        // Format results for the agent
        const results = data.data
          .map((result, i) => {
            const textContent = result.content
              .filter(c => c.type === 'text')
              .map(c => c.text)
              .join('\n');
            return `[Result ${i + 1}]\n${textContent}`;
          })
          .join('\n\n---\n\n');

        return results;
      } catch (error) {
        console.error('[search_knowledge_base] Error:', error);
        return 'An error occurred while searching the knowledge base. Please try again.';
      }
    },
  });
}
