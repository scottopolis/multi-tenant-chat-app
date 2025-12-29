import { useState } from 'react'

export interface McpServer {
  url: string
  authHeader?: string
  transport?: 'http' | 'sse'
}

export interface LangfuseConfig {
  publicKey?: string
  secretKey?: string
  host?: string
  promptName?: string
  label?: string
}

export interface AgentFormData {
  name: string
  systemPrompt: string
  model: string
  mcpServers: McpServer[]
  outputSchema: string
  langfuse: LangfuseConfig
}

interface AgentFormProps {
  initialData?: Partial<AgentFormData>
  onSubmit: (data: AgentFormData) => Promise<void>
  onCancel: () => void
  onDelete?: () => void
  isSubmitting?: boolean
  submitLabel?: string
}

const TABS = ['Basic', 'Tools & Output', 'Integrations'] as const
type Tab = (typeof TABS)[number]

const MODELS = [
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
]

export function AgentForm({
  initialData,
  onSubmit,
  onCancel,
  onDelete,
  isSubmitting = false,
  submitLabel = 'Save',
}: AgentFormProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Basic')
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(initialData?.name ?? '')
  const [systemPrompt, setSystemPrompt] = useState(initialData?.systemPrompt ?? '')
  const [model, setModel] = useState(initialData?.model ?? 'gpt-4.1-mini')
  const [mcpServers, setMcpServers] = useState<McpServer[]>(initialData?.mcpServers ?? [])
  const [outputSchema, setOutputSchema] = useState(initialData?.outputSchema ?? '')
  const [langfuse, setLangfuse] = useState<LangfuseConfig>(initialData?.langfuse ?? {})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    try {
      await onSubmit({
        name,
        systemPrompt,
        model,
        mcpServers,
        outputSchema,
        langfuse,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const addMcpServer = () => {
    setMcpServers([...mcpServers, { url: '', transport: 'http' }])
  }

  const updateMcpServer = (index: number, updates: Partial<McpServer>) => {
    setMcpServers(mcpServers.map((s, i) => (i === index ? { ...s, ...updates } : s)))
  }

  const removeMcpServer = (index: number) => {
    setMcpServers(mcpServers.filter((_, i) => i !== index))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-700">
        <nav className="-mb-px flex space-x-8">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-slate-800 shadow rounded-lg p-6">
        {activeTab === 'Basic' && (
          <div className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-white">
                Agent Name
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                  placeholder="e.g., Customer Support Agent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="systemPrompt" className="block text-sm font-medium text-white">
                System Prompt
              </label>
              <div className="mt-2">
                <textarea
                  id="systemPrompt"
                  rows={10}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                  placeholder="You are a helpful assistant that..."
                />
              </div>
              <p className="mt-2 text-sm text-gray-400">
                Define how your agent should behave. Can be overridden by Langfuse prompt.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'Tools & Output' && (
          <div className="space-y-8">
            {/* Model */}
            <div>
              <label htmlFor="model" className="block text-sm font-medium text-white">
                Model
              </label>
              <div className="mt-2">
                <select
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                >
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* MCP Servers */}
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-white">MCP Servers</label>
                <button
                  type="button"
                  onClick={addMcpServer}
                  className="text-sm text-cyan-400 hover:text-cyan-300"
                >
                  + Add Server
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-400">
                Connect external tool servers via Model Context Protocol.
              </p>

              {mcpServers.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500 italic">No MCP servers configured.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {mcpServers.map((server, index) => (
                    <div key={index} className="bg-slate-900 rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <span className="text-sm font-medium text-gray-400">Server {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeMcpServer(index)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      <div>
                        <input
                          type="url"
                          value={server.url}
                          onChange={(e) => updateMcpServer(index, { url: e.target.value })}
                          placeholder="https://mcp-server.example.com"
                          className="block w-full rounded-md border-0 bg-slate-800 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <input
                            type="text"
                            value={server.authHeader ?? ''}
                            onChange={(e) => updateMcpServer(index, { authHeader: e.target.value })}
                            placeholder="Authorization header (optional)"
                            className="block w-full rounded-md border-0 bg-slate-800 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <select
                            value={server.transport ?? 'http'}
                            onChange={(e) =>
                              updateMcpServer(index, { transport: e.target.value as 'http' | 'sse' })
                            }
                            className="block w-full rounded-md border-0 bg-slate-800 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                          >
                            <option value="http">HTTP</option>
                            <option value="sse">SSE</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Output Schema */}
            <div>
              <label htmlFor="outputSchema" className="block text-sm font-medium text-white">
                Output Schema (JSON)
              </label>
              <div className="mt-2">
                <textarea
                  id="outputSchema"
                  rows={6}
                  value={outputSchema}
                  onChange={(e) => setOutputSchema(e.target.value)}
                  className="block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white font-mono text-sm shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-cyan-500"
                  placeholder='{"type": "object", "properties": {...}}'
                />
              </div>
              <p className="mt-2 text-sm text-gray-400">
                Optional JSON Schema for structured output. Leave empty for free-form text.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'Integrations' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-white">Langfuse</h3>
              <p className="mt-1 text-sm text-gray-400">
                Connect to Langfuse for prompt management and tracing.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="langfusePublicKey" className="block text-sm font-medium text-white">
                  Public Key
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    id="langfusePublicKey"
                    value={langfuse.publicKey ?? ''}
                    onChange={(e) => setLangfuse({ ...langfuse, publicKey: e.target.value })}
                    className="block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                    placeholder="pk-lf-..."
                  />
                </div>
              </div>
              <div>
                <label htmlFor="langfuseSecretKey" className="block text-sm font-medium text-white">
                  Secret Key
                </label>
                <div className="mt-2">
                  <input
                    type="password"
                    id="langfuseSecretKey"
                    value={langfuse.secretKey ?? ''}
                    onChange={(e) => setLangfuse({ ...langfuse, secretKey: e.target.value })}
                    className="block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                    placeholder="sk-lf-..."
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="langfuseHost" className="block text-sm font-medium text-white">
                Host
              </label>
              <div className="mt-2">
                <input
                  type="url"
                  id="langfuseHost"
                  value={langfuse.host ?? ''}
                  onChange={(e) => setLangfuse({ ...langfuse, host: e.target.value })}
                  className="block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                  placeholder="https://cloud.langfuse.com (default)"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="langfusePromptName" className="block text-sm font-medium text-white">
                  Prompt Name
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    id="langfusePromptName"
                    value={langfuse.promptName ?? ''}
                    onChange={(e) => setLangfuse({ ...langfuse, promptName: e.target.value })}
                    className="block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                    placeholder="my-agent-prompt"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="langfuseLabel" className="block text-sm font-medium text-white">
                  Label
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    id="langfuseLabel"
                    value={langfuse.label ?? ''}
                    onChange={(e) => setLangfuse({ ...langfuse, label: e.target.value })}
                    className="block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                    placeholder="production"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
          >
            Delete Agent
          </button>
        ) : (
          <div />
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name}
            className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}
