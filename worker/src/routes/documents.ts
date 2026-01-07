import { Hono } from 'hono';
import { invalidateAgentCache } from '../tenants/config';

type Bindings = {
  CONVEX_URL?: string;
  OPENAI_API_KEY?: string;
};

type Variables = {
  agentId: string;
  orgId: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * Document Routes - Convex RAG Integration
 *
 * These routes proxy document operations to Convex actions.
 * Files are stored in Convex file storage and indexed via the RAG component.
 *
 * Flow:
 * 1. Upload: generateUploadUrl -> upload to Convex storage -> addDocument action
 * 2. Delete: removeDocument action
 * 3. List: listByAgent query
 */

/**
 * Helper: Get agent data from Convex (includes _id, tenantId)
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

  const data = (await response.json()) as { value: any };
  return data.value;
}

/**
 * Helper: Generate upload URL from Convex
 */
async function generateUploadUrl(convexUrl: string): Promise<string> {
  const response = await fetch(`${convexUrl}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'documents:generateUploadUrl',
      args: {},
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate upload URL: ${response.status}`);
  }

  const data = (await response.json()) as { value: string };
  return data.value;
}

/**
 * Helper: Call addDocument action in Convex
 */
async function addDocument(
  convexUrl: string,
  args: {
    tenantId: string;
    agentId: string;
    storageId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }
): Promise<{ documentId: string; success: boolean }> {
  const response = await fetch(`${convexUrl}/api/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'documents:addDocument',
      args,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to add document: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as { value: { documentId: string; success: boolean } };
  return data.value;
}

/**
 * Helper: Call removeDocument action in Convex
 */
async function removeDocument(
  convexUrl: string,
  documentId: string
): Promise<{ success: boolean; documentId: string }> {
  const response = await fetch(`${convexUrl}/api/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'documents:removeDocument',
      args: { documentId },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to remove document: ${response.status} - ${error}`);
  }

  const data = (await response.json()) as { value: { success: boolean; documentId: string } };
  return data.value;
}

/**
 * Helper: List documents for an agent from Convex
 */
async function listDocuments(convexUrl: string, agentId: string): Promise<any[]> {
  const response = await fetch(`${convexUrl}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'documents:listByAgent',
      args: { agentId },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to list documents: ${response.status}`);
  }

  const data = (await response.json()) as { value: any[] };
  return data.value || [];
}

/**
 * POST /api/documents/upload
 * Upload a file to the agent's knowledge base
 *
 * Flow:
 * 1. Validate file size and type
 * 2. Get agent data (for tenantId)
 * 3. Generate upload URL from Convex
 * 4. Upload file to Convex storage
 * 5. Call addDocument action to process and index
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
    const fileEntry = formData.get('file');

    if (!fileEntry || typeof fileEntry === 'string') {
      return c.json({ error: 'No file provided' }, 400);
    }
    const file = fileEntry as File;

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json(
        {
          error: 'File too large',
          details: `Maximum file size is 10MB, got ${(file.size / 1024 / 1024).toFixed(2)}MB`,
        },
        400
      );
    }

    // Validate file type
    const supportedTypes = ['text/plain', 'text/markdown'];
    const mimeType = file.type || 'text/plain';
    if (!supportedTypes.includes(mimeType)) {
      return c.json(
        {
          error: 'Unsupported file type',
          details: `Supported types: ${supportedTypes.join(', ')}. Got: ${mimeType}`,
        },
        400
      );
    }

    // Get agent data from Convex
    const agentData = await getAgentData(convexUrl, agentId);
    if (!agentData) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // Generate upload URL from Convex
    const uploadUrl = await generateUploadUrl(convexUrl);

    // Upload file to Convex storage
    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': mimeType },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload to Convex storage: ${uploadResponse.status}`);
    }

    const { storageId } = (await uploadResponse.json()) as { storageId: string };

    // Call addDocument action to process and index
    const result = await addDocument(convexUrl, {
      tenantId: agentData.tenantId,
      agentId: agentData._id,
      storageId,
      fileName: file.name,
      fileSize: file.size,
      mimeType,
    });

    // Invalidate cache so next request gets updated config
    invalidateAgentCache(agentId);

    return c.json(
      {
        success: true,
        documentId: result.documentId,
        fileName: file.name,
        fileSize: file.size,
      },
      201
    );
  } catch (error) {
    console.error('[Documents] Upload error:', error);
    return c.json(
      {
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

/**
 * DELETE /api/documents/:documentId
 * Delete a file from the agent's knowledge base
 */
app.delete('/:documentId', async (c) => {
  try {
    const convexUrl = c.env.CONVEX_URL;
    if (!convexUrl) {
      return c.json({ error: 'Service configuration error (CONVEX_URL)' }, 500);
    }

    const documentId = c.req.param('documentId');
    if (!documentId) {
      return c.json({ error: 'Document ID required' }, 400);
    }

    // Call removeDocument action
    const result = await removeDocument(convexUrl, documentId);

    return c.json({
      success: true,
      documentId: result.documentId,
    });
  } catch (error) {
    console.error('[Documents] Delete error:', error);
    return c.json(
      {
        error: 'Failed to delete file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
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

    // Get agent data to get the Convex agent _id
    const agentData = await getAgentData(convexUrl, agentId);
    if (!agentData) {
      return c.json({ error: 'Agent not found' }, 404);
    }

    // List documents from Convex
    const documents = await listDocuments(convexUrl, agentData._id);

    return c.json({
      files: documents.map((doc) => ({
        id: doc._id,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        status: doc.status,
        errorMessage: doc.errorMessage,
        createdAt: doc.createdAt,
      })),
    });
  } catch (error) {
    console.error('[Documents] List error:', error);
    return c.json(
      {
        error: 'Failed to list files',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default app;
