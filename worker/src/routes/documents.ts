import { Hono } from 'hono';
import { z } from 'zod';
import {
  createVectorStore,
  uploadFileToVectorStore,
  deleteFileFromVectorStore,
  listVectorStoreFiles,
} from '../lib/vectorStore';
import { invalidateAgentCache } from '../tenants/config';

type Bindings = {
  CONVEX_URL?: string;
};

type Variables = {
  agentId: string;
  orgId: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * Helper: Call Convex mutation to update agent's vectorStoreId
 */
async function updateAgentVectorStore(
  convexUrl: string,
  agentId: string,
  vectorStoreId: string
): Promise<void> {
  const response = await fetch(`${convexUrl}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'agents:updateVectorStoreId',
      args: { agentId, vectorStoreId },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update agent vector store: ${response.status}`);
  }
}

/**
 * Helper: Get agent data from Convex (includes _id and vectorStoreId)
 */
async function getAgentData(convexUrl: string, agentId: string): Promise<any> {
  const response = await fetch(`${convexUrl}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'agents:getByAgentId',
      args: { agentId },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get agent: ${response.status}`);
  }

  const data = await response.json();
  return data.value;
}

/**
 * Helper: Update agent record via Convex mutation
 */
async function patchAgent(
  convexUrl: string,
  id: string,
  updates: Record<string, any>
): Promise<void> {
  const response = await fetch(`${convexUrl}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'agents:update',
      args: { id, ...updates },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update agent: ${response.status}`);
  }
}

/**
 * POST /api/documents/upload
 * Upload a file to the agent's knowledge base
 */
app.post('/upload', async (c) => {
  try {
    const convexUrl = c.env.CONVEX_URL;
    if (!convexUrl) {
      return c.json({ error: 'Service configuration error (CONVEX_URL)' }, 500);
    }

    const agentId = c.get('agentId');

    // Get the uploaded file from form data
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Validate file size (max 10MB as per spec)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return c.json({
        error: 'File too large',
        details: `Maximum file size is 10MB, got ${(file.size / 1024 / 1024).toFixed(2)}MB`
      }, 400);
    }

    // Get agent data from Convex
    const agentData = await getAgentData(convexUrl, agentId);
    if (!agentData) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    let vectorStoreId = agentData.vectorStoreId;

    // Create vector store if it doesn't exist
    if (!vectorStoreId) {
      console.log(`[Documents] Creating vector store for agent: ${agentId}`);
      vectorStoreId = await createVectorStore(`${agentId}-knowledge-base`);

      // Update agent with new vectorStoreId
      await patchAgent(convexUrl, agentData._id, { vectorStoreId });

      // Invalidate cache so next request gets updated config
      invalidateAgentCache(agentId);

      console.log(`[Documents] Created vector store: ${vectorStoreId}`);
    }

    // Upload file to OpenAI Vector Store
    const fileId = await uploadFileToVectorStore(vectorStoreId, file, file.name);

    console.log(`[Documents] Uploaded file ${file.name} (${fileId}) to vector store ${vectorStoreId}`);

    return c.json({
      success: true,
      fileId,
      vectorStoreId,
      fileName: file.name,
      fileSize: file.size,
    }, 201);
  } catch (error) {
    console.error('[Documents] Upload error:', error);
    return c.json({
      error: 'Failed to upload file',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * DELETE /api/documents/:fileId
 * Delete a file from the agent's knowledge base
 */
app.delete('/:fileId', async (c) => {
  try {
    const convexUrl = c.env.CONVEX_URL;
    if (!convexUrl) {
      return c.json({ error: 'Service configuration error (CONVEX_URL)' }, 500);
    }

    const agentId = c.get('agentId');
    const fileId = c.req.param('fileId');

    if (!fileId) {
      return c.json({ error: 'File ID required' }, 400);
    }

    // Get agent data from Convex
    const agentData = await getAgentData(convexUrl, agentId);
    if (!agentData) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    const vectorStoreId = agentData.vectorStoreId;
    if (!vectorStoreId) {
      return c.json({ error: 'No vector store configured for this agent' }, 404);
    }

    // Delete file from OpenAI Vector Store
    await deleteFileFromVectorStore(vectorStoreId, fileId);

    console.log(`[Documents] Deleted file ${fileId} from vector store ${vectorStoreId}`);

    return c.json({
      success: true,
      fileId,
    });
  } catch (error) {
    console.error('[Documents] Delete error:', error);
    return c.json({
      error: 'Failed to delete file',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/documents
 * List all documents for the agent's knowledge base
 */
app.get('/', async (c) => {
  try {
    const convexUrl = c.env.CONVEX_URL;
    if (!convexUrl) {
      return c.json({ error: 'Service configuration error (CONVEX_URL)' }, 500);
    }

    const agentId = c.get('agentId');

    // Get agent data from Convex
    const agentData = await getAgentData(convexUrl, agentId);
    if (!agentData) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    const vectorStoreId = agentData.vectorStoreId;
    if (!vectorStoreId) {
      // No vector store = no documents
      return c.json({ files: [] });
    }

    // List files from OpenAI Vector Store (cached)
    const files = await listVectorStoreFiles(vectorStoreId);

    return c.json({
      files: files.map((file) => ({
        id: file.id,
        status: file.status,
        createdAt: file.created_at,
      })),
    });
  } catch (error) {
    console.error('[Documents] List error:', error);
    return c.json({
      error: 'Failed to list files',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default app;
