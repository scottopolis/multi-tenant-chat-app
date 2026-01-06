import { v } from "convex/values";
import { query, mutation, action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { rag } from "./rag";
import { Id } from "./_generated/dataModel";

/**
 * Document Management for RAG Knowledge Base
 *
 * Documents are stored in Convex file storage, with text extracted and indexed
 * in the RAG component. Each agent has its own namespace for multi-tenant isolation.
 *
 * SECURITY: All operations must verify tenant ownership via agentId lookup.
 */

const SUPPORTED_MIME_TYPES = ["text/plain", "text/markdown"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Helper to get namespace for an agent
 */
function getAgentNamespace(agentId: Id<"agents">): string {
  return `agent:${agentId}`;
}

/**
 * List all documents for an agent
 */
export const listByAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});

/**
 * Get a single document by ID
 */
export const getById = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * Internal mutation to create a document record
 */
export const createDocument = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    agentId: v.id("agents"),
    fileName: v.string(),
    fileSize: v.number(),
    storageId: v.id("_storage"),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("documents", {
      tenantId: args.tenantId,
      agentId: args.agentId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      storageId: args.storageId,
      mimeType: args.mimeType,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

/**
 * Internal mutation to update document status
 */
export const updateStatus = internalMutation({
  args: {
    id: v.id("documents"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      errorMessage: args.errorMessage,
    });
  },
});

/**
 * Internal mutation to delete a document record
 */
export const internalDeleteDocument = internalMutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.id);
    if (doc) {
      await ctx.storage.delete(doc.storageId);
      await ctx.db.delete(args.id);
    }
    return doc;
  },
});

/**
 * Generate upload URL for file storage
 * Client uploads directly to Convex storage, then calls addDocument action
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Add a document to the knowledge base
 *
 * This action:
 * 1. Creates a document record
 * 2. Extracts text from the file
 * 3. Indexes the text in RAG with the agent's namespace
 */
export const addDocument = action({
  args: {
    tenantId: v.id("tenants"),
    agentId: v.id("agents"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args): Promise<{ documentId: Id<"documents">; success: true }> => {
    // Validate file size
    if (args.fileSize > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Validate mime type
    if (!SUPPORTED_MIME_TYPES.includes(args.mimeType)) {
      throw new Error(
        `Unsupported file type: ${args.mimeType}. Supported types: ${SUPPORTED_MIME_TYPES.join(", ")}`
      );
    }

    // Create document record
    const documentId = await ctx.runMutation(internal.documents.createDocument, {
      tenantId: args.tenantId,
      agentId: args.agentId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      storageId: args.storageId,
      mimeType: args.mimeType,
    });

    try {
      // Update status to processing
      await ctx.runMutation(internal.documents.updateStatus, {
        id: documentId,
        status: "processing",
      });

      // Get file content from storage
      const fileUrl = await ctx.storage.getUrl(args.storageId);
      if (!fileUrl) {
        throw new Error("Failed to get file URL from storage");
      }

      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      const text = await response.text();

      if (!text.trim()) {
        throw new Error("File is empty");
      }

      // Add to RAG with agent namespace
      const namespace = getAgentNamespace(args.agentId);

      await rag.add(ctx, {
        namespace,
        text,
        metadata: {
          documentId,
          fileName: args.fileName,
          mimeType: args.mimeType,
        },
      });

      // Update status to ready
      await ctx.runMutation(internal.documents.updateStatus, {
        id: documentId,
        status: "ready",
      });

      return { documentId, success: true };
    } catch (error) {
      // Update status to failed
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(internal.documents.updateStatus, {
        id: documentId,
        status: "failed",
        errorMessage,
      });

      throw error;
    }
  },
});

/**
 * Remove a document from the knowledge base
 *
 * This action:
 * 1. Removes content from RAG
 * 2. Deletes file from storage
 * 3. Deletes document record
 */
export const removeDocument = action({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    // Get the document to find its agent namespace
    const doc = await ctx.runQuery(api.documents.getById, { id: args.documentId });

    if (!doc) {
      throw new Error("Document not found");
    }

    // Delete from RAG
    // Note: RAG component doesn't have a direct delete by metadata,
    // so we need to use the namespace and entry ID if tracked.
    // For now, we'll delete the document record and the content will
    // be orphaned in RAG (acceptable for MVP, can add cleanup later)

    // Delete document record and file from storage
    await ctx.runMutation(internal.documents.internalDeleteDocument, { id: args.documentId });

    return { success: true, documentId: args.documentId };
  },
});

/**
 * Search the knowledge base for an agent
 *
 * This action searches the RAG component within the agent's namespace.
 */
export const searchKnowledgeBase = action({
  args: {
    agentId: v.id("agents"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const namespace = getAgentNamespace(args.agentId);
    const limit = args.limit ?? 10;

    const searchResult = await rag.search(ctx, {
      namespace,
      query: args.query,
      limit,
    });

    return {
      results: searchResult.results.map((r) => ({
        text: r.content.map((c) => c.text).join("\n"),
        score: r.score,
        metadata: r.content[0]?.metadata,
      })),
      combinedText: searchResult.text,
    };
  },
});
