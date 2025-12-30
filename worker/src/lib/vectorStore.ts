import OpenAI from 'openai';

const openai = new OpenAI();

export async function createVectorStore(name: string): Promise<string> {
  const store = await openai.vectorStores.create({ name });
  return store.id;
}

export async function deleteVectorStore(id: string): Promise<void> {
  await openai.vectorStores.del(id);
}

export async function uploadFileToVectorStore(
  vectorStoreId: string,
  file: File,
  filename: string
): Promise<string> {
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
  await openai.vectorStores.files.del(vectorStoreId, fileId);
  await openai.files.del(fileId);
}
