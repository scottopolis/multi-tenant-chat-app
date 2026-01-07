import { tool } from '@openai/agents';
import { z } from 'zod';

/**
 * Creates a function-based knowledge base search tool using Convex RAG.
 *
 * This tool calls the Convex searchKnowledgeBase action to query the RAG component.
 * It works with both regular agents and RealtimeAgent (voice agents).
 *
 * @param agentConvexId - The Convex document ID of the agent (e.g., "abc123...")
 * @param convexUrl - Convex deployment URL
 * @returns A function tool compatible with OpenAI Agents SDK
 */
export function createKnowledgeBaseSearchTool(agentConvexId: string, convexUrl: string) {
  return tool({
    name: 'search_knowledge_base',
    description:
      "Search the knowledge base for information relevant to the user's question. Use this when users ask about topics that might be covered in documentation, guides, or other uploaded materials.",
    parameters: z.object({
      query: z.string().describe('The search query to find relevant information'),
    }),
    execute: async ({ query }) => {
      console.log(`[search_knowledge_base] Searching for: ${query} (agent: ${agentConvexId})`);

      try {
        const response = await fetch(`${convexUrl}/api/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: 'documents:searchKnowledgeBase',
            args: {
              agentId: agentConvexId,
              query,
              limit: 5,
            },
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          console.error(`[search_knowledge_base] Convex error: ${response.status} ${error}`);
          return `Unable to search the knowledge base at this time. Please try again.`;
        }

        const data = (await response.json()) as {
          value: {
            results: Array<{
              text: string;
              score: number;
              metadata?: { documentId?: string; fileName?: string };
            }>;
            combinedText: string;
          };
        };

        const results = data.value.results;

        if (!results || results.length === 0) {
          return 'No relevant information found in the knowledge base for that query.';
        }

        // Format results for the agent
        const formattedResults = results
          .map((result, i) => {
            const source = result.metadata?.fileName ? ` (from: ${result.metadata.fileName})` : '';
            return `[Result ${i + 1}]${source}\n${result.text}`;
          })
          .join('\n\n---\n\n');

        return formattedResults;
      } catch (error) {
        console.error('[search_knowledge_base] Error:', error);
        return 'An error occurred while searching the knowledge base. Please try again.';
      }
    },
  });
}

// Keep old export for backward compatibility during migration
/** @deprecated Use createKnowledgeBaseSearchTool instead */
export const createVectorSearchTool = createKnowledgeBaseSearchTool;
