import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex-backend/convex/_generated/api'
import type { Id } from '../../../convex-backend/convex/_generated/dataModel'

interface ApiKeysProps {
  tenantId: Id<'tenants'>
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateApiKey(): string {
  return `sk_live_${crypto.randomUUID().replace(/-/g, '')}`
}

export function ApiKeys({ tenantId }: ApiKeysProps) {
  const keys = useQuery(api.apiKeys.listByTenant, { tenantId })
  const createKey = useMutation(api.apiKeys.create)
  const revokeKey = useMutation(api.apiKeys.revoke)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreateKey = async () => {
    if (!keyName.trim()) {
      setError('Please enter a name for the API key')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      const fullKey = generateApiKey()
      const keyHash = await hashApiKey(fullKey)
      const keyPrefix = fullKey.substring(0, 12) + '...'

      await createKey({
        tenantId,
        keyHash,
        keyPrefix,
        name: keyName.trim(),
      })

      setNewlyCreatedKey(fullKey)
      setKeyName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create API key')
    } finally {
      setIsCreating(false)
    }
  }

  const handleCopyKey = async () => {
    if (newlyCreatedKey) {
      await navigator.clipboard.writeText(newlyCreatedKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleCloseNewKeyModal = () => {
    setNewlyCreatedKey(null)
    setShowCreateModal(false)
    setCopied(false)
  }

  const handleRevoke = async (keyId: Id<'apiKeys'>) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return
    }

    try {
      await revokeKey({ id: keyId, tenantId })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key')
    }
  }

  const formatDate = (timestamp: number | undefined) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (keys === undefined) {
    return <p className="text-gray-400">Loading API keys...</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">API Keys</h3>
          <p className="mt-1 text-sm text-gray-400">
            Manage API keys for authenticating widget requests.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600"
        >
          Generate New Key
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {keys.length === 0 ? (
        <div className="bg-slate-900 rounded-lg p-6 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <h4 className="mt-4 text-sm font-medium text-white">No API keys</h4>
          <p className="mt-1 text-sm text-gray-400">
            Generate an API key to authenticate your widget.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Key</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Last Used</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {keys.map((key) => (
                <tr key={key.id}>
                  <td className="px-4 py-3 text-sm text-white">{key.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-400 font-mono">{key.keyPrefix}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{formatDate(key.createdAt)}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{formatDate(key.lastUsedAt)}</td>
                  <td className="px-4 py-3 text-sm">
                    {key.revokedAt ? (
                      <span className="inline-flex items-center rounded-full bg-red-900/50 px-2 py-0.5 text-xs font-medium text-red-400">
                        Revoked
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-green-900/50 px-2 py-0.5 text-xs font-medium text-green-400">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    {!key.revokedAt && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(key.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Key Modal */}
      {showCreateModal && !newlyCreatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-medium text-white mb-4">Generate New API Key</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="keyName" className="block text-sm font-medium text-white">
                  Key Name
                </label>
                <input
                  type="text"
                  id="keyName"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="e.g., Production Widget"
                  className="mt-2 block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setKeyName('')
                    setError(null)
                  }}
                  className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateKey}
                  disabled={isCreating}
                  className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600 disabled:opacity-50"
                >
                  {isCreating ? 'Generating...' : 'Generate Key'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show New Key Modal */}
      {newlyCreatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-lg shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <svg className="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-lg font-medium text-white">Save Your API Key</h3>
            </div>
            
            <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-3 mb-4">
              <p className="text-yellow-400 text-sm">
                This is the only time you will see this key. Copy it now and store it securely.
              </p>
            </div>

            <div className="bg-slate-900 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between gap-4">
                <code className="text-cyan-400 font-mono text-sm break-all">{newlyCreatedKey}</code>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  className="shrink-0 rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-600 flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCloseNewKeyModal}
                className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
