import OpenAI from 'openai';

// In Cloudflare Workers, env vars come from context, not process.env
// We need to pass the API key to each function
function getOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

// Simple in-memory cache for Vector Store file listings
type VectorStoreFile = Awaited<ReturnType<InstanceType<typeof OpenAI>['vectorStores']['files']['list']>>['data'][number];

interface CacheEntry {
  data: VectorStoreFile[];
  timestamp: number;
}

const fileListCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30000; // 30 seconds

export async function createVectorStore(apiKey: string, name: string): Promise<string> {
  const openai = getOpenAIClient(apiKey);
  const store = await openai.vectorStores.create({ name });
  return store.id;
}

export async function deleteVectorStore(apiKey: string, id: string): Promise<void> {
  const openai = getOpenAIClient(apiKey);
  await openai.vectorStores.delete(id);
}

export async function uploadFileToVectorStore(
  apiKey: string,
  vectorStoreId: string,
  file: File,
  filename: string
): Promise<string> {
  const openai = getOpenAIClient(apiKey);

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
  apiKey: string,
  vectorStoreId: string,
  fileId: string
): Promise<void> {
  const openai = getOpenAIClient(apiKey);
  await openai.vectorStores.files.delete(fileId, { vector_store_id: vectorStoreId });
  await openai.files.delete(fileId);

  // Invalidate cache after deletion
  fileListCache.delete(vectorStoreId);
}

/**
 * List files in a Vector Store with caching
 * Cache TTL: 30 seconds
 */
export async function listVectorStoreFiles(
  apiKey: string,
  vectorStoreId: string,
  options?: { forceRefresh?: boolean }
): Promise<VectorStoreFile[]> {
  const now = Date.now();

  // Check cache unless force refresh
  if (!options?.forceRefresh) {
    const cached = fileListCache.get(vectorStoreId);
    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // Fetch from OpenAI
  const openai = getOpenAIClient(apiKey);
  const response = await openai.vectorStores.files.list(vectorStoreId);
  const files = response.data;

  // Update cache
  fileListCache.set(vectorStoreId, {
    data: files,
    timestamp: now,
  });

  return files;
}
