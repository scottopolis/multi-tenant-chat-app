import { useEffect, useState } from 'react'
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
  agentId?: string
  agentDbId?: Id<'agents'>
  initialTab?: string
}

const BASE_TABS = ['Basic', 'Tools & Output', 'Integrations'] as const
const ALL_TABS = ['Basic', 'Tools & Output', 'Integrations', 'Security', 'Knowledge Base', 'Voice', 'Embed'] as const
type Tab = (typeof ALL_TABS)[number]

const MODELS = [
  { value: 'gpt-5.2', label: 'GPT-5.2' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
  { value: 'llama-4-scout', label: 'Llama 4 Scout' },
  { value: 'deepseek-v3', label: 'DeepSeek V3' },
  { value: 'qwen-3-235b', label: 'Qwen 3 235B' },
]

const VOICE_MODELS = [
  { value: 'gpt-realtime', label: 'GPT Realtime' },
  { value: 'gpt-4o-realtime-preview', label: 'GPT-4o Realtime Preview' },
]

const VOICE_PERSONAS = [
  { value: 'verse', label: 'Verse' },
  { value: 'alloy', label: 'Alloy' },
  { value: 'ash', label: 'Ash' },
  { value: 'ballad', label: 'Ballad' },
  { value: 'coral', label: 'Coral' },
  { value: 'echo', label: 'Echo' },
  { value: 'sage', label: 'Sage' },
  { value: 'shimmer', label: 'Shimmer' },
  { value: 'marin', label: 'Marin' },
  { value: 'cedar', label: 'Cedar' },
]

const AGENT_TEMPLATES = [
  {
    id: 'sales-inbound',
    name: 'Sales Assistant (Inbound)',
    description: 'Qualify leads and route to a demo or sales rep.',
    prompt:
      'You are a friendly sales assistant for a B2B SaaS company. Your goal is to qualify inbound leads, understand company size, use case, timeline, and decision-makers, and offer to book a demo. Ask 1–2 concise questions at a time. Be helpful, confident, and never make up pricing or product details—ask to connect with sales if unsure.',
  },
  {
    id: 'support-tier1',
    name: 'Customer Support (Tier 1)',
    description: 'Triage issues and provide clear troubleshooting steps.',
    prompt:
      'You are a customer support assistant. Help users resolve common issues with clear step-by-step instructions. Ask clarifying questions when needed, confirm success, and summarize next steps. If the issue needs escalation, collect key details (account email, product area, error message, steps tried) and explain that a human agent will follow up.',
  },
  {
    id: 'onboarding',
    name: 'Onboarding Concierge',
    description: 'Guide new customers through setup and activation.',
    prompt:
      'You are an onboarding concierge. Guide new customers through setup, integration, and activation. Provide a short plan, then walk them through each step. Highlight best practices and common pitfalls. If a step requires human help, offer to connect them and capture their goal and timeline.',
  },
] as const

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
  initialTab,
}: AgentFormProps) {
  const tabs = agentId ? ALL_TABS : BASE_TABS
  const resolvedInitialTab = tabs.includes(initialTab as Tab) ? (initialTab as Tab) : 'Basic'
  const [activeTab, setActiveTab] = useState<Tab>(resolvedInitialTab)
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  useEffect(() => {
    if (tabs.includes(initialTab as Tab)) {
      setActiveTab(initialTab as Tab)
    }
  }, [initialTab, tabs])

  const applyTemplate = () => {
    const template = AGENT_TEMPLATES.find((item) => item.id === selectedTemplateId)
    if (!template) return
    const hasContent = systemPrompt.trim().length > 0
    if (hasContent && !window.confirm('Replace the current system prompt with this template?')) {
      return
    }
    setSystemPrompt(template.prompt)
  }

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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {activeTab === 'Basic' && (
          <div className="space-y-6">
            {/* Agent Capabilities - only show for new agents */}
            {!agentId && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Capabilities
                </label>
                <p className="text-sm text-gray-500 mb-4">
                  Select how users can interact with this agent. You can enable both.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <label
                    className={`p-4 rounded-lg border-2 text-left transition-colors cursor-pointer ${
                      capabilities.web
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={capabilities.web}
                        onChange={(e) => setCapabilities({ ...capabilities, web: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <svg className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                      </svg>
                      <div>
                        <p className="font-medium text-gray-900">Web Chat</p>
                        <p className="text-sm text-gray-500">Embed in websites via widget</p>
                      </div>
                    </div>
                  </label>
                  <label
                    className={`p-4 rounded-lg border-2 text-left transition-colors cursor-pointer ${
                      capabilities.voice
                        ? 'border-gray-900 bg-gray-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={capabilities.voice}
                        onChange={(e) => setCapabilities({ ...capabilities, voice: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <svg className="h-5 w-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <div>
                        <p className="font-medium text-gray-900">Voice</p>
                        <p className="text-sm text-gray-500">Phone calls via Twilio</p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-900">
                Agent Name
              </label>
              <div className="mt-2">
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                  placeholder="e.g., Customer Support Agent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900">
                Agent Template (optional)
              </label>
              <p className="mt-1 text-sm text-gray-500">
                Start with a proven prompt for sales or support teams.
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                  >
                    <option value="">No template</option>
                    {AGENT_TEMPLATES.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  {selectedTemplateId && (
                    <p className="mt-2 text-sm text-gray-500">
                      {AGENT_TEMPLATES.find((item) => item.id === selectedTemplateId)?.description}
                    </p>
                  )}
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={applyTemplate}
                    disabled={!selectedTemplateId}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Apply template
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="systemPrompt" className="block text-sm font-medium text-gray-900">
                System Prompt
              </label>
              <div className="mt-2">
                <textarea
                  id="systemPrompt"
                  rows={10}
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                  placeholder="You are a helpful assistant that..."
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Define how your agent should behave. Can be overridden by Langfuse prompt.
              </p>
            </div>

            {/* Voice Configuration - only show for new agents with voice capability */}
            {!agentId && capabilities.voice && (
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-base font-medium text-gray-900 mb-4">Voice Configuration</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="voiceModel" className="block text-sm font-medium text-gray-900">
                      Model
                    </label>
                    <select
                      id="voiceModel"
                      value={voiceConfig.voiceModel}
                      onChange={(e) => setVoiceConfig({ ...voiceConfig, voiceModel: e.target.value })}
                      className="mt-2 block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                    >
                      {VOICE_MODELS.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="voiceName" className="block text-sm font-medium text-gray-900">
                      Voice
                    </label>
                    <select
                      id="voiceName"
                      value={voiceConfig.voiceName}
                      onChange={(e) => setVoiceConfig({ ...voiceConfig, voiceName: e.target.value })}
                      className="mt-2 block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                    >
                      {VOICE_PERSONAS.map((v) => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label htmlFor="locale" className="block text-sm font-medium text-gray-900">
                      Locale
                    </label>
                    <select
                      id="locale"
                      value={voiceConfig.locale}
                      onChange={(e) => setVoiceConfig({ ...voiceConfig, locale: e.target.value })}
                      className="mt-2 block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
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
                        className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <span className="text-gray-700 text-sm">Allow barge-in (interruptions)</span>
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
              <label htmlFor="model" className="block text-sm font-medium text-gray-900">
                Model
              </label>
              <div className="mt-2">
                <select
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
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
                <label className="block text-sm font-medium text-gray-900">MCP Servers</label>
                <button
                  type="button"
                  onClick={addMcpServer}
                  className="text-sm text-gray-900 hover:text-gray-600 font-medium"
                >
                  + Add Server
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Connect external tool servers via Model Context Protocol.
              </p>

              {mcpServers.length === 0 ? (
                <p className="mt-4 text-sm text-gray-400 italic">No MCP servers configured.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {mcpServers.map((server, index) => (
                    <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <span className="text-sm font-medium text-gray-500">Server {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeMcpServer(index)}
                          className="text-red-600 hover:text-red-500 text-sm"
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
                          className="block w-full rounded-lg border border-gray-300 bg-white py-2 px-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <input
                            type="text"
                            value={server.authHeader ?? ''}
                            onChange={(e) => updateMcpServer(index, { authHeader: e.target.value })}
                            placeholder="Authorization header (optional)"
                            className="block w-full rounded-lg border border-gray-300 bg-white py-2 px-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                          />
                        </div>
                        <div>
                          <select
                            value={server.transport ?? 'http'}
                            onChange={(e) =>
                              updateMcpServer(index, { transport: e.target.value as 'http' | 'sse' })
                            }
                            className="block w-full rounded-lg border border-gray-300 bg-white py-2 px-3 text-gray-900 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
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
              <label htmlFor="outputSchema" className="block text-sm font-medium text-gray-900">
                Output Schema (JSON)
              </label>
              <div className="mt-2">
                <textarea
                  id="outputSchema"
                  rows={6}
                  value={outputSchema}
                  onChange={(e) => setOutputSchema(e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-2 px-3 text-gray-900 font-mono text-sm placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900"
                  placeholder='{"type": "object", "properties": {...}}'
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Optional JSON Schema for structured output. Leave empty for free-form text.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'Integrations' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-medium text-gray-900">Langfuse</h3>
              <p className="mt-1 text-sm text-gray-500">
                Connect to Langfuse for prompt management and tracing.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="langfusePublicKey" className="block text-sm font-medium text-gray-900">
                  Public Key
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    id="langfusePublicKey"
                    value={langfuse.publicKey ?? ''}
                    onChange={(e) => setLangfuse({ ...langfuse, publicKey: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                    placeholder="pk-lf-..."
                  />
                </div>
              </div>
              <div>
                <label htmlFor="langfuseSecretKey" className="block text-sm font-medium text-gray-900">
                  Secret Key
                </label>
                <div className="mt-2">
                  <input
                    type="password"
                    id="langfuseSecretKey"
                    value={langfuse.secretKey ?? ''}
                    onChange={(e) => setLangfuse({ ...langfuse, secretKey: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                    placeholder="sk-lf-..."
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="langfuseHost" className="block text-sm font-medium text-gray-900">
                Host
              </label>
              <div className="mt-2">
                <input
                  type="url"
                  id="langfuseHost"
                  value={langfuse.host ?? ''}
                  onChange={(e) => setLangfuse({ ...langfuse, host: e.target.value })}
                  className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                  placeholder="https://cloud.langfuse.com (default)"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="langfusePromptName" className="block text-sm font-medium text-gray-900">
                  Prompt Name
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    id="langfusePromptName"
                    value={langfuse.promptName ?? ''}
                    onChange={(e) => setLangfuse({ ...langfuse, promptName: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                    placeholder="my-agent-prompt"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="langfuseLabel" className="block text-sm font-medium text-gray-900">
                  Label
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    id="langfuseLabel"
                    value={langfuse.label ?? ''}
                    onChange={(e) => setLangfuse({ ...langfuse, label: e.target.value })}
                    className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
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
              <h3 className="text-base font-medium text-gray-900">Domain Allowlist</h3>
              <p className="mt-1 text-sm text-gray-500">
                Restrict which domains can embed and use this agent. Requests from other domains will be rejected.
              </p>
            </div>

            {/* Wildcard Warning */}
            {domainsInput.includes('*') && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-amber-800 text-sm font-medium">Wildcard domain detected</p>
                    <p className="text-amber-700 text-sm mt-1">
                      Using <code className="bg-amber-100 px-1 rounded">*</code> allows any website to embed your widget.
                      For production, specify your actual domains.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="allowedDomains" className="block text-sm font-medium text-gray-900">
                Allowed Domains
              </label>
              <p className="mt-1 text-sm text-gray-500 mb-2">
                Enter one domain per line. Use <code className="text-gray-900">*</code> to allow all domains (not recommended for production).
                Wildcards like <code className="text-gray-900">*.example.com</code> match subdomains.
              </p>
              <textarea
                id="allowedDomains"
                rows={5}
                value={domainsInput}
                onChange={(e) => setDomainsInput(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-2 px-3 text-gray-900 font-mono text-sm placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900"
                placeholder="example.com&#10;*.example.org&#10;app.mysite.io"
              />
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Examples</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><code className="text-gray-900">example.com</code> — matches only example.com</li>
                <li><code className="text-gray-900">*.example.com</code> — matches app.example.com, www.example.com, etc.</li>
                <li><code className="text-gray-900">localhost</code> — matches localhost (for development)</li>
                <li><code className="text-gray-900">*</code> — matches any domain (not secure for production)</li>
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
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 transition-colors"
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
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name}
            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}
