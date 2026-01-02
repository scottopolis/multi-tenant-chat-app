import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import documentRoutes from './documents';
import { createVectorStore, deleteVectorStore } from '../lib/vectorStore';

/**
 * Document Routes Integration Tests
 *
 * Tests the upload/delete/list endpoints with real OpenAI API
 * Skip if OPENAI_API_KEY or mock Convex is not available
 */

// Mock Convex for testing
const mockConvexUrl = 'http://mock-convex.test';
let testVectorStoreId: string | null = null;
let testAgentId = 'test-agent-docs';

// Simple mock Convex server
const mockConvexServer = {
  agents: new Map<string, any>(),
};

// Helper to setup mock fetch
function setupMockFetch() {
  const originalFetch = global.fetch;

  global.fetch = async (url: any, options: any) => {
    const urlStr = url.toString();

    // Mock Convex endpoints
    if (urlStr.includes(mockConvexUrl)) {
      const body = JSON.parse(options.body);

      // Query: getByAgentId
      if (body.path === 'agents:getByAgentId') {
        const agent = mockConvexServer.agents.get(body.args.agentId);
        return new Response(JSON.stringify({ value: agent || null }));
      }

      // Mutation: update
      if (body.path === 'agents:update') {
        const agent = mockConvexServer.agents.get(testAgentId);
        if (agent && body.args.id === agent._id) {
          Object.assign(agent, body.args);
          mockConvexServer.agents.set(testAgentId, agent);
        }
        return new Response(JSON.stringify({ value: agent?._id }));
      }

      // Mutation: updateVectorStoreId
      if (body.path === 'agents:updateVectorStoreId') {
        const agent = mockConvexServer.agents.get(body.args.agentId);
        if (agent) {
          agent.vectorStoreId = body.args.vectorStoreId;
          mockConvexServer.agents.set(body.args.agentId, agent);
        }
        return new Response(JSON.stringify({ value: agent?._id }));
      }
    }

    // Pass through to real OpenAI API
    return originalFetch(url, options);
  };

  return () => {
    global.fetch = originalFetch;
  };
}

describe('Document Routes', () => {
  const apiKey = process.env.OPENAI_API_KEY;
  const shouldSkip = !apiKey || apiKey.includes('your-api-key');

  beforeAll(async () => {
    if (shouldSkip) return;

    // Setup mock agent in mock Convex
    mockConvexServer.agents.set(testAgentId, {
      _id: 'mock-id-123',
      agentId: testAgentId,
      orgId: 'test-org',
      name: 'Test Agent',
      model: 'gpt-4.1-mini',
      vectorStoreId: null,
    });
  });

  afterAll(async () => {
    if (shouldSkip) return;

    // Clean up: delete test vector store if created
    if (testVectorStoreId && apiKey) {
      try {
        await deleteVectorStore(apiKey, testVectorStoreId);
        console.log(`✅ Cleaned up test vector store: ${testVectorStoreId}`);
      } catch (error) {
        console.warn('Failed to clean up vector store:', error);
      }
    }
  });

  it('should upload a file and create vector store', async () => {
    if (shouldSkip) {
      console.log('Skipping document upload test - no valid OPENAI_API_KEY found');
      return;
    }

    const restoreFetch = setupMockFetch();

    try {
      // Create test app with document routes
      const app = new Hono();

      // Mock middleware to set variables
      app.use('*', async (c, next) => {
        c.set('agentId' as any, testAgentId);
        c.set('orgId' as any, 'test-org');
        c.env = { CONVEX_URL: mockConvexUrl, OPENAI_API_KEY: apiKey };
        await next();
      });

      app.route('/api/documents', documentRoutes);

      // Create test file
      const content = 'Test document content for RAG';
      const blob = new Blob([content], { type: 'text/plain' });
      const file = new File([blob], 'test-doc.txt', { type: 'text/plain' });

      // Create form data
      const formData = new FormData();
      formData.append('file', file);

      // Upload file
      const uploadReq = new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadRes = await app.fetch(uploadReq);

      expect(uploadRes.status).toBe(201);

      const uploadData = await uploadRes.json() as { success: boolean; fileId: string; vectorStoreId: string; fileName: string };
      expect(uploadData.success).toBe(true);
      expect(uploadData.fileId).toBeDefined();
      expect(uploadData.vectorStoreId).toBeDefined();
      expect(uploadData.fileName).toBe('test-doc.txt');

      testVectorStoreId = uploadData.vectorStoreId;

      console.log(`✅ Uploaded file: ${uploadData.fileId}`);
      console.log(`✅ Vector store created: ${testVectorStoreId}`);
    } finally {
      restoreFetch();
    }
  }, 30000);

  it('should list documents from vector store', async () => {
    if (shouldSkip || !testVectorStoreId) {
      console.log('Skipping list test - no vector store available');
      return;
    }

    const restoreFetch = setupMockFetch();

    try {
      // Update mock agent with vectorStoreId
      const agent = mockConvexServer.agents.get(testAgentId);
      if (agent) {
        agent.vectorStoreId = testVectorStoreId;
        mockConvexServer.agents.set(testAgentId, agent);
      }

      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('agentId' as any, testAgentId);
        c.set('orgId' as any, 'test-org');
        c.env = { CONVEX_URL: mockConvexUrl, OPENAI_API_KEY: apiKey };
        await next();
      });
      app.route('/api/documents', documentRoutes);

      // List documents
      const listReq = new Request('http://localhost/api/documents?agent=' + testAgentId);
      const listRes = await app.fetch(listReq);

      expect(listRes.status).toBe(200);

      const listData = await listRes.json();
      expect(listData.files).toBeDefined();
      expect(Array.isArray(listData.files)).toBe(true);
      expect(listData.files.length).toBeGreaterThan(0);

      console.log(`✅ Listed ${listData.files.length} file(s)`);
    } finally {
      restoreFetch();
    }
  }, 15000);

  it('should delete a file from vector store', async () => {
    if (shouldSkip || !testVectorStoreId) {
      console.log('Skipping delete test - no vector store available');
      return;
    }

    const restoreFetch = setupMockFetch();

    try {
      // First get the file ID from the list
      const agent = mockConvexServer.agents.get(testAgentId);
      if (agent) {
        agent.vectorStoreId = testVectorStoreId;
      }

      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('agentId' as any, testAgentId);
        c.set('orgId' as any, 'test-org');
        c.env = { CONVEX_URL: mockConvexUrl, OPENAI_API_KEY: apiKey };
        await next();
      });
      app.route('/api/documents', documentRoutes);

      // List to get file ID
      const listReq = new Request('http://localhost/api/documents?agent=' + testAgentId);
      const listRes = await app.fetch(listReq);
      const listData = await listRes.json();

      if (listData.files.length === 0) {
        console.log('⚠️  No files to delete');
        return;
      }

      const fileId = listData.files[0].id;

      // Delete file
      const deleteReq = new Request(`http://localhost/api/documents/${fileId}?agent=${testAgentId}`, {
        method: 'DELETE',
      });
      const deleteRes = await app.fetch(deleteReq);

      expect(deleteRes.status).toBe(200);

      const deleteData = await deleteRes.json();
      expect(deleteData.success).toBe(true);
      expect(deleteData.fileId).toBe(fileId);

      console.log(`✅ Deleted file: ${fileId}`);
    } finally {
      restoreFetch();
    }
  }, 20000);

  it('should reject files larger than 10MB', async () => {
    if (shouldSkip) {
      console.log('Skipping file size test - no OPENAI_API_KEY');
      return;
    }

    const restoreFetch = setupMockFetch();

    try {
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('agentId' as any, testAgentId);
        c.set('orgId' as any, 'test-org');
        c.env = { CONVEX_URL: mockConvexUrl, OPENAI_API_KEY: apiKey };
        await next();
      });
      app.route('/api/documents', documentRoutes);

      // Create a large file (11MB)
      const largeContent = 'x'.repeat(11 * 1024 * 1024);
      const blob = new Blob([largeContent], { type: 'text/plain' });
      const file = new File([blob], 'large-file.txt', { type: 'text/plain' });

      const formData = new FormData();
      formData.append('file', file);

      const uploadReq = new Request('http://localhost/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadRes = await app.fetch(uploadReq);

      expect(uploadRes.status).toBe(400);

      const errorData = await uploadRes.json();
      expect(errorData.error).toBe('File too large');

      console.log('✅ Correctly rejected large file');
    } finally {
      restoreFetch();
    }
  }, 10000);
});
