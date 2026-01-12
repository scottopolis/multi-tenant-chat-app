import { useState } from 'react'
import { KnowledgeBase } from './KnowledgeBase'
import { VoiceSettings } from './VoiceSettings'
import { EmbedCode } from './EmbedCode'
import type { Id } from '../../../convex-backend/convex/_generated/dataModel'

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

export interface AgentCapabilities {
  web: boolean
  voice: boolean
}

export interface VoiceConfig {
  voiceModel: string
  voiceName: string
  locale: string
  bargeInEnabled: boolean
}

export interface AgentFormData {
  name: string
  systemPrompt: string
  model: string
  mcpServers: McpServer[]
  outputSchema: string
  langfuse: LangfuseConfig
  capabilities: AgentCapabilities
  voiceConfig?: VoiceConfig
  allowedDomains: string[]
}

interface AgentFormProps {
  initialData?: Partial<AgentFormData>
  onSubmit: (data: AgentFormData) => Promise<void>
  onCancel: () => void
  onDelete?: () => void
  isSubmitting?: boolean
  submitLabel?: string
  agentId?: string // For existing agents - enables Knowledge Base and Voice tabs
  agentDbId?: Id<'agents'> // Convex document ID for existing agents
}

const BASE_TABS = ['Basic', 'Tools & Output', 'Integrations'] as const
const ALL_TABS = ['Basic', 'Tools & Output', 'Integrations', 'Security', 'Knowledge Base', 'Voice', 'Embed'] as const
type Tab = (typeof ALL_TABS)[number]

const MODELS = [
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
]

const VOICE_MODELS = [
  { value: 'gpt-realtime', label: 'GPT Realtime' },
  { value: 'gpt-4o-realtime-preview', label: 'GPT-4o Realtime Preview' },
]

const VOICE_PERSONAS = [
  { value: 'verse', label: 'Verse' },
  { value: 'alloy', label: 'Alloy' },
  { value: 'echo', label: 'Echo' },
  { value: 'fable', label: 'Fable' },
  { value: 'onyx', label: 'Onyx' },
  { value: 'nova', label: 'Nova' },
  { value: 'shimmer', label: 'Shimmer' },
]

const LOCALES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'es-MX', label: 'Spanish (Mexico)' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'ja-JP', label: 'Japanese' },
  { value: 'ko-KR', label: 'Korean' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
]

export function AgentForm({
  initialData,
  onSubmit,
  onCancel,
  onDelete,
  isSubmitting = false,
  submitLabel = 'Save',
  agentId,
  agentDbId,
}: AgentFormProps) {
  // Only show Knowledge Base tab for existing agents
  const tabs = agentId ? ALL_TABS : BASE_TABS
  const [activeTab, setActiveTab] = useState<Tab>('Basic')
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState(initialData?.name ?? '')
  const [systemPrompt, setSystemPrompt] = useState(initialData?.systemPrompt ?? '')
  const [model, setModel] = useState(initialData?.model ?? 'gpt-4.1-mini')
  const [mcpServers, setMcpServers] = useState<McpServer[]>(initialData?.mcpServers ?? [])
  const [outputSchema, setOutputSchema] = useState(initialData?.outputSchema ?? '')
  const [langfuse, setLangfuse] = useState<LangfuseConfig>(initialData?.langfuse ?? {})
  const [capabilities, setCapabilities] = useState<AgentCapabilities>(initialData?.capabilities ?? {
    web: true,
    voice: false,
  })
  const [voiceConfig, setVoiceConfig] = useState<VoiceConfig>(initialData?.voiceConfig ?? {
    voiceModel: 'gpt-realtime',
    voiceName: 'verse',
    locale: 'en-US',
    bargeInEnabled: true,
  })
  const [domainsInput, setDomainsInput] = useState<string>(
    (initialData?.allowedDomains ?? ['*']).join('\n')
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedDomains = domainsInput
      .split(/[\n,]/)
      .map(d => d.trim())
      .filter(d => d.length > 0)

    try {
      await onSubmit({
        name,
        systemPrompt,
        model,
        mcpServers,
        outputSchema,
        langfuse,
        capabilities,
        voiceConfig: capabilities.voice ? voiceConfig : undefined,
        allowedDomains: parsedDomains.length > 0 ? parsedDomains : ['*'],
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
          {tabs.map((tab) => (
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
            {/* Agent Capabilities - only show for new agents */}
            {!agentId && (
              <div>
                <label className="block text-sm font-medium text-white mb-3">
                  Capabilities
                </label>
                <p className="text-sm text-gray-400 mb-4">
                  Select how users can interact with this agent. You can enable both.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <label
                    className={`p-4 rounded-lg border-2 text-left transition-colors cursor-pointer ${
                      capabilities.web
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-slate-600 bg-slate-900 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={capabilities.web}
                        onChange={(e) => setCapabilities({ ...capabilities, web: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                      />
                      <svg className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <div>
                        <p className="font-medium text-white">Web Chat</p>
                        <p className="text-sm text-gray-400">Embed in websites via widget</p>
                      </div>
                    </div>
                  </label>
                  <label
                    className={`p-4 rounded-lg border-2 text-left transition-colors cursor-pointer ${
                      capabilities.voice
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-slate-600 bg-slate-900 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={capabilities.voice}
                        onChange={(e) => setCapabilities({ ...capabilities, voice: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                      />
                      <svg className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <div>
                        <p className="font-medium text-white">Voice</p>
                        <p className="text-sm text-gray-400">Phone calls via Twilio</p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

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

            {/* Voice Configuration - only show for new agents with voice capability */}
            {!agentId && capabilities.voice && (
              <div className="border-t border-slate-700 pt-6">
                <h4 className="text-md font-medium text-white mb-4">Voice Configuration</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="voiceModel" className="block text-sm font-medium text-white">
                      Model
                    </label>
                    <select
                      id="voiceModel"
                      value={voiceConfig.voiceModel}
                      onChange={(e) => setVoiceConfig({ ...voiceConfig, voiceModel: e.target.value })}
                      className="mt-2 block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                    >
                      {VOICE_MODELS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="voiceName" className="block text-sm font-medium text-white">
                      Voice
                    </label>
                    <select
                      id="voiceName"
                      value={voiceConfig.voiceName}
                      onChange={(e) => setVoiceConfig({ ...voiceConfig, voiceName: e.target.value })}
                      className="mt-2 block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                    >
                      {VOICE_PERSONAS.map((v) => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label htmlFor="locale" className="block text-sm font-medium text-white">
                      Locale
                    </label>
                    <select
                      id="locale"
                      value={voiceConfig.locale}
                      onChange={(e) => setVoiceConfig({ ...voiceConfig, locale: e.target.value })}
                      className="mt-2 block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                    >
                      {LOCALES.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-3 pb-2">
                      <input
                        type="checkbox"
                        checked={voiceConfig.bargeInEnabled}
                        onChange={(e) => setVoiceConfig({ ...voiceConfig, bargeInEnabled: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                      />
                      <span className="text-white text-sm">Allow barge-in (interruptions)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
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

        {activeTab === 'Security' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-white">Domain Allowlist</h3>
              <p className="mt-1 text-sm text-gray-400">
                Restrict which domains can embed and use this agent. Requests from other domains will be rejected.
              </p>
            </div>

            {/* Wildcard Warning */}
            {domainsInput.includes('*') && (
              <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-yellow-400 text-sm font-medium">Wildcard domain detected</p>
                    <p className="text-yellow-400/80 text-sm mt-1">
                      Using <code className="bg-slate-800 px-1 rounded">*</code> allows any website to embed your widget.
                      For production, specify your actual domains.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="allowedDomains" className="block text-sm font-medium text-white">
                Allowed Domains
              </label>
              <p className="mt-1 text-sm text-gray-400 mb-2">
                Enter one domain per line. Use <code className="text-cyan-400">*</code> to allow all domains (not recommended for production).
                Wildcards like <code className="text-cyan-400">*.example.com</code> match subdomains.
              </p>
              <textarea
                id="allowedDomains"
                rows={5}
                value={domainsInput}
                onChange={(e) => setDomainsInput(e.target.value)}
                className="block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white font-mono text-sm shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-cyan-500"
                placeholder="example.com&#10;*.example.org&#10;app.mysite.io"
              />
            </div>

            <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
              <h4 className="text-sm font-medium text-white mb-2">Examples</h4>
              <ul className="text-sm text-gray-400 space-y-1">
                <li><code className="text-cyan-400">example.com</code> — matches only example.com</li>
                <li><code className="text-cyan-400">*.example.com</code> — matches app.example.com, www.example.com, etc.</li>
                <li><code className="text-cyan-400">localhost</code> — matches localhost (for development)</li>
                <li><code className="text-cyan-400">*</code> — matches any domain (not secure for production)</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'Knowledge Base' && agentId && (
          <KnowledgeBase agentId={agentId} />
        )}

        {activeTab === 'Voice' && agentId && agentDbId && (
          <VoiceSettings agentId={agentId} agentDbId={agentDbId} />
        )}

        {activeTab === 'Embed' && agentId && (
          <EmbedCode agentId={agentId} />
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
