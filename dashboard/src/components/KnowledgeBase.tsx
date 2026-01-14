import { useState, useEffect, useCallback } from 'react'

interface VectorStoreFile {
  id: string
  status: string
  createdAt: number
}

interface KnowledgeBaseProps {
  agentId: string
  workerUrl?: string
}

const ACCEPTED_TYPES = ['.pdf', '.txt', '.md', '.csv']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function KnowledgeBase({ agentId, workerUrl = 'http://localhost:8787' }: KnowledgeBaseProps) {
  const [files, setFiles] = useState<VectorStoreFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchFiles = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`${workerUrl}/api/documents?agent=${agentId}`)
      if (!res.ok) {
        throw new Error(`Failed to fetch documents: ${res.status}`)
      }
      const data = await res.json()
      setFiles(data.files || [])
    } catch (err) {
      console.error('Error fetching files:', err)
      setError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setIsLoading(false)
    }
  }, [agentId, workerUrl])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ACCEPTED_TYPES.includes(ext)) {
      setError(`Invalid file type. Accepted: ${ACCEPTED_TYPES.join(', ')}`)
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large. Maximum size is 10MB.`)
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${workerUrl}/api/documents/upload?agent=${agentId}`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Upload failed: ${res.status}`)
      }

      await fetchFiles()
    } catch (err) {
      console.error('Error uploading file:', err)
      setError(err instanceof Error ? err.message : 'Failed to upload file')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  const handleDelete = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    setDeletingId(fileId)
    setError(null)

    try {
      const res = await fetch(`${workerUrl}/api/documents/${fileId}?agent=${agentId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || `Delete failed: ${res.status}`)
      }

      await fetchFiles()
    } catch (err) {
      console.error('Error deleting file:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete file')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-50 text-green-700',
      in_progress: 'bg-amber-50 text-amber-700',
      failed: 'bg-red-50 text-red-700',
    }
    return colors[status] || 'bg-gray-50 text-gray-700'
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-medium text-gray-900">Knowledge Base</h3>
        <p className="mt-1 text-sm text-gray-500">
          Upload documents to give your agent access to custom knowledge. Supports PDF, TXT, MD, and CSV files.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Upload Zone */}
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-gray-400 transition-colors">
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileSelect}
          disabled={isUploading}
        />
        <label
          htmlFor="file-upload"
          className={`cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="mt-4">
            {isUploading ? (
              <span className="text-gray-900 font-medium">Uploading...</span>
            ) : (
              <>
                <span className="text-gray-900 font-medium hover:text-gray-600">Click to upload</span>
                <span className="text-gray-500"> or drag and drop</span>
              </>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            PDF, TXT, MD, CSV up to 10MB
          </p>
        </label>
      </div>

      {/* Document List */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Documents {!isLoading && `(${files.length})`}
        </h4>

        {isLoading ? (
          <p className="text-gray-400 text-sm italic">Loading documents...</p>
        ) : files.length === 0 ? (
          <p className="text-gray-400 text-sm italic">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <svg
                    className="h-5 w-5 text-gray-400 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate" title={file.id}>
                      {file.id}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(file.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusBadge(file.status)}`}>
                    {file.status}
                  </span>
                  <button
                    onClick={() => handleDelete(file.id)}
                    disabled={deletingId === file.id}
                    className="text-red-600 hover:text-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete document"
                  >
                    {deletingId === file.id ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
