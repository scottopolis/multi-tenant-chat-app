import OpenAI from 'openai';

// Lazy initialization to avoid requiring API key at module import time
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI();
  }
  return openaiClient;
}

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

  return uploadedFile.id;
}

export async function deleteFileFromVectorStore(
  vectorStoreId: string,
  fileId: string
): Promise<void> {
  const openai = getOpenAIClient();
  await openai.vectorStores.files.del(vectorStoreId, fileId);
  await openai.files.del(fileId);
}
