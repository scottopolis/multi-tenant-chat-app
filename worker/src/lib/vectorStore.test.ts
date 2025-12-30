import { describe, it, expect } from 'vitest';
import {
  createVectorStore,
  deleteVectorStore,
  uploadFileToVectorStore,
  deleteFileFromVectorStore
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
});
