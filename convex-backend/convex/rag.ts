import { components } from "./_generated/api";
import { RAG } from "@convex-dev/rag";
import { openai } from "@ai-sdk/openai";

/**
 * RAG instance for knowledge base functionality.
 *
 * Uses namespaces for multi-tenant isolation: one namespace per agent (e.g., "agent:{agentId}")
 * This replaces the OpenAI Vector Store integration.
 */
export const rag = new RAG(components.rag, {
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  embeddingDimension: 1536,
});
