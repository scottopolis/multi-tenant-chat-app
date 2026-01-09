import { components } from "./_generated/api";
import { RAG } from "@convex-dev/rag";
import { createOpenAI } from "@ai-sdk/openai";

/**
 * RAG instance for knowledge base functionality.
 *
 * Uses namespaces for multi-tenant isolation: one namespace per agent (e.g., "agent:{agentId}")
 * This replaces the OpenAI Vector Store integration.
 *
 * Uses OpenRouter for embedding models (provider-agnostic).
 * Requires OPENROUTER_API_KEY to be set in Convex environment variables:
 *   npx convex env set OPENROUTER_API_KEY <your-key>
 */

// Create OpenRouter instance for embeddings
const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

export const rag = new RAG(components.rag, {
  textEmbeddingModel: openrouter.embedding("text-embedding-3-small"),
  embeddingDimension: 1536,
});
