import { describe, it, expect } from 'vitest';
import {
  createVectorStore,
  deleteVectorStore,
  uploadFileToVectorStore,
  deleteFileFromVectorStore,
  listVectorStoreFiles
} from './vectorStore';

/**
 * Vector Store integration tests - testing real OpenAI API behavior
 * Focus: End-to-end workflows for RAG knowledgebase feature
 *
 * These tests validate actual OpenAI Vector Store API integration.
 * Skip tests if OPENAI_API_KEY is not available.
 */
describe('Vector Store Management', () => {
  const apiKey = process.env.OPENAI_API_KEY;
  const shouldSkip = !apiKey || apiKey.includes('your-api-key');

  it('should create and delete a vector store', async () => {
    if (shouldSkip) {
      console.log('Skipping vector store test - no valid OPENAI_API_KEY found');
      return;
    }

    // Create a vector store
    const vectorStoreId = await createVectorStore('test-knowledge-base');
    expect(vectorStoreId).toBeDefined();
    expect(typeof vectorStoreId).toBe('string');
    expect(vectorStoreId.startsWith('vs_')).toBe(true);

    console.log(`✅ Created vector store: ${vectorStoreId}`);

    // Clean up - delete the vector store
    await deleteVectorStore(vectorStoreId);
    console.log(`✅ Deleted vector store: ${vectorStoreId}`);
  }, 15000);

  it('should handle full file lifecycle: upload → attach → delete', async () => {
    if (shouldSkip) {
      console.log('Skipping file upload test - no valid OPENAI_API_KEY found');
      return;
    }

    // Create a test vector store
    const vectorStoreId = await createVectorStore('test-file-upload');
    expect(vectorStoreId).toBeDefined();

    // Create a test file (simple text content)
    const content = 'This is a test document for RAG. It contains information about testing.';
    const blob = new Blob([content], { type: 'text/plain' });
    const file = new File([blob], 'test.txt', { type: 'text/plain' });

    // Upload file to vector store
    const fileId = await uploadFileToVectorStore(vectorStoreId, file, 'test.txt');
    expect(fileId).toBeDefined();
    expect(typeof fileId).toBe('string');
    expect(fileId.startsWith('file-')).toBe(true);

    console.log(`✅ Uploaded file: ${fileId} to vector store: ${vectorStoreId}`);

    // Delete the file from vector store
    await deleteFileFromVectorStore(vectorStoreId, fileId);
    console.log(`✅ Deleted file: ${fileId} from vector store`);

    // Clean up - delete the vector store
    await deleteVectorStore(vectorStoreId);
    console.log(`✅ Cleaned up vector store: ${vectorStoreId}`);
  }, 30000);

  it('should cache file listings and invalidate on changes', async () => {
    if (shouldSkip) {
      console.log('Skipping cache test - no valid OPENAI_API_KEY found');
      return;
    }

    // Create a test vector store
    const vectorStoreId = await createVectorStore('test-cache');
    expect(vectorStoreId).toBeDefined();

    // Initially should be empty
    const files1 = await listVectorStoreFiles(vectorStoreId);
    expect(files1).toEqual([]);
    console.log(`✅ Initial list: 0 files`);

    // Upload a file
    const content = 'Test content for caching';
    const blob = new Blob([content], { type: 'text/plain' });
    const file = new File([blob], 'cache-test.txt', { type: 'text/plain' });
    const fileId = await uploadFileToVectorStore(vectorStoreId, file, 'cache-test.txt');
    console.log(`✅ Uploaded file: ${fileId}`);

    // List should show 1 file (cache invalidated by upload)
    const files2 = await listVectorStoreFiles(vectorStoreId);
    expect(files2.length).toBe(1);
    expect(files2[0].id).toBe(fileId);
    console.log(`✅ After upload: 1 file in list`);

    // List again - should use cache (same result, faster)
    const startTime = Date.now();
    const files3 = await listVectorStoreFiles(vectorStoreId);
    const cachedTime = Date.now() - startTime;
    expect(files3.length).toBe(1);
    console.log(`✅ Cached list returned in ${cachedTime}ms`);

    // Force refresh
    const refreshStart = Date.now();
    const files4 = await listVectorStoreFiles(vectorStoreId, { forceRefresh: true });
    const refreshTime = Date.now() - refreshStart;
    expect(files4.length).toBe(1);
    console.log(`✅ Force refresh returned in ${refreshTime}ms`);

    // Delete file - should invalidate cache
    await deleteFileFromVectorStore(vectorStoreId, fileId);
    console.log(`✅ Deleted file: ${fileId}`);

    // List should be empty again
    const files5 = await listVectorStoreFiles(vectorStoreId);
    expect(files5.length).toBe(0);
    console.log(`✅ After delete: 0 files in list`);

    // Clean up
    await deleteVectorStore(vectorStoreId);
    console.log(`✅ Cleaned up vector store: ${vectorStoreId}`);
  }, 60000);
});
