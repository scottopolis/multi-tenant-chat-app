import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { ChevronDown } from 'lucide-react'
import { KnowledgeBase } from './KnowledgeBase'
import { VoiceSettings, type VoiceSettingsHandle } from './VoiceSettings'
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

export interface AgentFormData {
  name: string
  systemPrompt: string
  model: string
  mcpServers: McpServer[]
  outputSchema: string
  langfuse: LangfuseConfig
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

const ALL_TABS = ['Basic', 'Tools & Output', 'Integrations', 'Security', 'Knowledge Base', 'Voice', 'Embed'] as const
type Tab = (typeof ALL_TABS)[number]
type AgentFormValues = AgentFormData & {
  allowedDomainsInput: string
}

const MODELS = [
  { value: 'gpt-5.2', label: 'GPT-5.2' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { value: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
  { value: 'llama-4-scout', label: 'Llama 4 Scout' },
  { value: 'deepseek-v3', label: 'DeepSeek V3' },
  { value: 'qwen-3-235b', label: 'Qwen 3 235B' },
]

const SECTION_IDS = {
  basic: 'agent-basic',
  tools: 'agent-tools',
  response: 'agent-response',
  security: 'agent-security',
  integrations: 'agent-integrations',
  knowledge: 'agent-knowledge',
  voice: 'agent-voice',
  embed: 'agent-embed',
  advanced: 'agent-advanced',
} as const

const TAB_TO_SECTION: Record<Tab, string> = {
  Basic: SECTION_IDS.basic,
  'Tools & Output': SECTION_IDS.tools,
  Integrations: SECTION_IDS.integrations,
  Security: SECTION_IDS.security,
  'Knowledge Base': SECTION_IDS.knowledge,
  Voice: SECTION_IDS.voice,
  Embed: SECTION_IDS.embed,
}

export function AgentForm({
  initialData,
  onSubmit: onSubmitForm,
  onCancel,
  onDelete,
  isSubmitting = false,
  submitLabel = 'Save',
  agentId,
  agentDbId,
  initialTab,
}: AgentFormProps) {
  const [error, setError] = useState<string | null>(null)
  const voiceSettingsRef = useRef<VoiceSettingsHandle | null>(null)
  const [voiceDirty, setVoiceDirty] = useState(false)

  const isEmptyMcpServer = (server?: Partial<McpServer> | null) => {
    const url = server?.url?.trim() ?? ''
    const authHeader = server?.authHeader?.trim() ?? ''
    return url.length === 0 && authHeader.length === 0
  }

  const buildDefaultValues = (data?: Partial<AgentFormData>): AgentFormValues => ({
    name: data?.name ?? '',
    systemPrompt: data?.systemPrompt ?? '',
    model: data?.model ?? 'gpt-4.1-mini',
    mcpServers: (data?.mcpServers ?? []).filter((server) => !isEmptyMcpServer(server)),
    outputSchema: data?.outputSchema ?? '',
    langfuse: data?.langfuse ?? {},
    allowedDomains: data?.allowedDomains ?? ['*'],
    allowedDomainsInput: (data?.allowedDomains ?? ['*']).join('\n'),
  })

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    getValues,
    formState: { errors, isDirty, isValid, dirtyFields, isSubmitting: isFormSubmitting },
  } = useForm<AgentFormValues>({
    defaultValues: buildDefaultValues(initialData),
    mode: 'onChange',
    shouldUnregister: true,
  })

  const { fields: mcpServerFields, append, remove } = useFieldArray({
    control,
    name: 'mcpServers',
  })

  const name = watch('name')
  const outputSchema = watch('outputSchema')
  const domainsInput = watch('allowedDomainsInput') ?? ''
  const isBusy = isSubmitting || isFormSubmitting
  const hasUnsavedChanges = isDirty || voiceDirty

  useEffect(() => {
    if (!initialTab) return
    const sectionId = TAB_TO_SECTION[initialTab as Tab]
    if (!sectionId) return
    const timer = setTimeout(() => {
      const element = document.getElementById(sectionId)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [initialTab])

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (!hash) return
    const timer = setTimeout(() => {
      const element = document.getElementById(hash)
      if (!element) return
      if (element instanceof HTMLDetailsElement && !element.open) {
        element.open = true
      }
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  const hasOutputSchema = (outputSchema ?? '').trim().length > 0

  useEffect(() => {
    reset(buildDefaultValues(initialData))
  }, [initialData, reset])

  const handleFormSubmit = async (values: AgentFormValues) => {
    setError(null)

    const parsedDomains = (values.allowedDomainsInput ?? '')
      .split(/[\n,]/)
      .map((domain) => domain.trim())
      .filter((domain) => domain.length > 0)

    const cleanedServers = (values.mcpServers ?? [])
      .map((server) => ({
        url: server.url.trim(),
        authHeader: server.authHeader?.trim() || undefined,
        transport: server.transport ?? 'http',
      }))
      .filter((server) => server.url.length > 0)

    try {
      await onSubmitForm({
        name: values.name,
        systemPrompt: values.systemPrompt,
        model: values.model,
        mcpServers: cleanedServers,
        outputSchema: values.outputSchema,
        langfuse: values.langfuse,
        allowedDomains: parsedDomains.length > 0 ? parsedDomains : ['*'],
      })
      await voiceSettingsRef.current?.save()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const addMcpServer = () => {
    append({ url: '', authHeader: '', transport: 'http' })
  }

  const pruneEmptyServer = (index: number) => {
    const row = getValues(`mcpServers.${index}`)
    if (isEmptyMcpServer(row)) {
      remove(index)
    }
  }

  const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype

  const collectFieldPaths = (value: unknown, prefix = ''): string[] => {
    if (!value || typeof value !== 'object') return []
    if (Array.isArray(value)) {
      return value.flatMap((item, index) => {
        if (item === true) return [`${prefix}[${index}]`]
        if (isPlainObject(item)) {
          return collectFieldPaths(item, `${prefix}[${index}]`)
        }
        return []
      })
    }
    if (!isPlainObject(value)) return []

    return Object.entries(value).flatMap(([key, entry]) => {
      const path = prefix ? `${prefix}.${key}` : key
      if (entry === true) return [path]
      if (isPlainObject(entry) || Array.isArray(entry)) {
        return collectFieldPaths(entry, path)
      }
      return []
    })
  }

  const invalidFieldPaths = collectFieldPaths(errors)
  const hasInvalidPaths = invalidFieldPaths.length > 0

  const Section = ({
    id,
    title,
    description,
    children,
  }: {
    id: string
    title: string
    description?: string
    children: ReactNode
  }) => (
    <section id={id} className="rounded-xl border border-gray-200 bg-white p-6 space-y-6">
      <div>
        <h3 className="text-base font-medium text-gray-900">{title}</h3>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {children}
    </section>
  )

  const CollapsibleSection = ({
    id,
    title,
    description,
    children,
    defaultOpen = true,
  }: {
    id: string
    title: string
    description?: string
    children: ReactNode
    defaultOpen?: boolean
  }) => (
    <details id={id} className="group rounded-xl border border-gray-200 bg-white" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5">
        <div>
          <p className="text-base font-medium text-gray-900">{title}</p>
          {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
        <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-gray-200 px-6 py-6 space-y-6">{children}</div>
    </details>
  )

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} noValidate className="space-y-8 pb-28">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        <CollapsibleSection
          id={SECTION_IDS.basic}
          title="Agent basics"
          description="Define what this agent is and how it should communicate."
        >
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-900">
              Agent Name
            </label>
            <div className="mt-2">
              <input
                type="text"
                id="name"
                {...register('name', { required: 'Agent name is required' })}
                aria-invalid={errors.name ? 'true' : 'false'}
                className={`block w-full rounded-lg border py-2.5 px-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900 sm:text-sm ${
                  errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                }`}
                placeholder="e.g., Customer Support Agent"
              />
            </div>
            {errors.name && (
              <p className="mt-2 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="systemPrompt" className="block text-sm font-medium text-gray-900">
              System Prompt
            </label>
            <div className="mt-2">
              <textarea
                id="systemPrompt"
                rows={10}
                {...register('systemPrompt')}
                className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                placeholder="You are a helpful assistant that..."
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              Define how your agent should behave. Can be overridden by Langfuse prompt.
            </p>
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          id={SECTION_IDS.tools}
          title="Model and tools"
          description="Choose a model and connect external tool servers."
        >
          <div>
            <label htmlFor="model" className="block text-sm font-medium text-gray-900">
              Model
            </label>
            <div className="mt-2">
              <select
                id="model"
                {...register('model', { required: true })}
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

            {mcpServerFields.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400 italic">No MCP servers configured.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {mcpServerFields.map((server, index) => (
                  <div key={server.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <span className="text-sm font-medium text-gray-500">Server {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="text-red-600 hover:text-red-500 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                    <div>
                      {(() => {
                        const urlField = register(`mcpServers.${index}.url`)
                        return (
                          <input
                            type="url"
                            defaultValue={server.url}
                            {...urlField}
                            onBlur={(event) => {
                              urlField.onBlur(event)
                              pruneEmptyServer(index)
                            }}
                            placeholder="https://mcp-server.example.com"
                            className="block w-full rounded-lg border bg-white py-2 px-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900 sm:text-sm border-gray-300"
                          />
                        )
                      })()}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        {(() => {
                          const authField = register(`mcpServers.${index}.authHeader`)
                          return (
                            <input
                              type="text"
                              defaultValue={server.authHeader ?? ''}
                              {...authField}
                              onBlur={(event) => {
                                authField.onBlur(event)
                                pruneEmptyServer(index)
                              }}
                              placeholder="Authorization header (optional)"
                              className="block w-full rounded-lg border border-gray-300 bg-white py-2 px-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                            />
                          )
                        })()}
                      </div>
                      <div>
                        <select
                          defaultValue={server.transport ?? 'http'}
                          {...register(`mcpServers.${index}.transport`)}
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
        </CollapsibleSection>

        {hasOutputSchema && (
          <CollapsibleSection
            id={SECTION_IDS.response}
            title="Response schema (legacy)"
            description="This agent has a structured response schema configured."
          >
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 space-y-3">
              <p>
                Editing response schemas is currently hidden to keep setup simple.
                If you need to update this schema, let us know and we can expose the editor.
              </p>
              <pre className="bg-white border border-gray-200 rounded-lg p-3 overflow-x-auto text-xs text-gray-700">
                {outputSchema}
              </pre>
            </div>
          </CollapsibleSection>
        )}

        {agentId && (
          <CollapsibleSection
            id={SECTION_IDS.knowledge}
            title="Knowledge base"
            description="Upload files to power retrieval."
            defaultOpen={false}
          >
            <KnowledgeBase agentId={agentId} />
          </CollapsibleSection>
        )}

        {agentId && agentDbId && (
          <CollapsibleSection
            id={SECTION_IDS.voice}
            title="Voice settings"
            description="Manage phone numbers and call behavior."
          >
            <VoiceSettings
              ref={voiceSettingsRef}
              agentId={agentId}
              agentDbId={agentDbId}
              onDirtyChange={setVoiceDirty}
            />
          </CollapsibleSection>
        )}

        {agentId && (
          <CollapsibleSection
            id={SECTION_IDS.embed}
            title="Embed and API keys"
            description="Copy the widget embed code and manage keys."
          >
            <EmbedCode agentId={agentId} />
          </CollapsibleSection>
        )}

        <CollapsibleSection
          id={SECTION_IDS.security}
          title="Advanced settings"
          description="Security and optional integrations."
          defaultOpen={false}
        >
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Domain allowlist</h4>
              <p className="mt-1 text-sm text-gray-500">
                Restrict which domains can embed and use this agent.
              </p>
            </div>

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
                {...register('allowedDomainsInput')}
                className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-2 px-3 text-gray-900 font-mono text-sm placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900"
                placeholder="example.com&#10;*.example.org&#10;app.mysite.io"
              />
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h5 className="text-sm font-medium text-gray-900 mb-2">Examples</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><code className="text-gray-900">example.com</code> — matches only example.com</li>
                <li><code className="text-gray-900">*.example.com</code> — matches app.example.com, www.example.com, etc.</li>
                <li><code className="text-gray-900">localhost</code> — matches localhost (for development)</li>
                <li><code className="text-gray-900">*</code> — matches any domain (not secure for production)</li>
              </ul>
            </div>

            <div className="border-t border-gray-200 pt-6 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Integrations</h4>
                <p className="mt-1 text-sm text-gray-500">
                  Connect external systems like Langfuse.
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
                      {...register('langfuse.publicKey')}
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
                      {...register('langfuse.secretKey')}
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
                    {...register('langfuse.host')}
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
                      {...register('langfuse.promptName')}
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
                      {...register('langfuse.label')}
                      className="block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                      placeholder="production"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {onDelete && (
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Delete agent</h4>
                  <p className="mt-1 text-sm text-gray-500">
                    Permanently remove this agent and its settings.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (!window.confirm('Are you sure you want to delete this agent?')) return
                    await onDelete()
                  }}
                  className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 transition-colors"
                >
                  Delete Agent
                </button>
              </div>
            </div>
          )}
        </CollapsibleSection>
      </div>

      <div className="sticky bottom-0 z-20 border-t border-gray-200 bg-gray-50/95 backdrop-blur">
        <div className="flex justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3 text-sm">
            {hasUnsavedChanges ? (
              <span className="text-amber-700 font-medium">Unsaved changes</span>
            ) : (
              <span className="text-gray-500">All changes saved</span>
            )}
            {hasUnsavedChanges && hasInvalidPaths && (
              <span className="text-red-600">Fix highlighted fields</span>
            )}
          </div>
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
              disabled={isBusy || !hasUnsavedChanges}
              className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBusy ? 'Saving...' : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
