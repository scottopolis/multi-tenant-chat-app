import OpenAI from 'openai';

// Lazy initialization to avoid requiring API key at module import time
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

// Simple in-memory cache for Vector Store file listings
interface CacheEntry {
  data: OpenAI.VectorStoreFile[];
  timestamp: number;
}

const fileListCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30000; // 30 seconds

export async function createVectorStore(name: string): Promise<string> {
  const openai = getOpenAIClient();
  const store = await openai.vectorStores.create({ name });
  return store.id;
}

export async function deleteVectorStore(id: string): Promise<void> {
  const openai = getOpenAIClient();
  await openai.vectorStores.del(id);
}

export async function uploadFileToVectorStore(
  vectorStoreId: string,
  file: File,
  filename: string
): Promise<string> {
  const openai = getOpenAIClient();

  // Upload file to OpenAI
  const uploadedFile = await openai.files.create({
    file,
    purpose: 'assistants',
  });

  // Attach to vector store
  await openai.vectorStores.files.create(vectorStoreId, {
    file_id: uploadedFile.id,
  });

  // Invalidate cache after upload
  fileListCache.delete(vectorStoreId);

  return uploadedFile.id;
}

export async function deleteFileFromVectorStore(
  vectorStoreId: string,
  fileId: string
): Promise<void> {
  const openai = getOpenAIClient();
  await openai.vectorStores.files.del(vectorStoreId, fileId);
  await openai.files.del(fileId);

  // Invalidate cache after deletion
  fileListCache.delete(vectorStoreId);
}

/**
 * List files in a Vector Store with caching
 * Cache TTL: 30 seconds
 */
export async function listVectorStoreFiles(
  vectorStoreId: string,
  options?: { forceRefresh?: boolean }
): Promise<OpenAI.VectorStoreFile[]> {
  const now = Date.now();

  // Check cache unless force refresh
  if (!options?.forceRefresh) {
    const cached = fileListCache.get(vectorStoreId);
    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // Fetch from OpenAI
  const openai = getOpenAIClient();
  const response = await openai.vectorStores.files.list(vectorStoreId);
  const files = response.data;

  // Update cache
  fileListCache.set(vectorStoreId, {
    data: files,
    timestamp: now,
  });

  return files;
}
