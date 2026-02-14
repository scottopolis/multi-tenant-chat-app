import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../../convex-backend/convex/_generated/api'
import { AgentForm, type AgentFormData } from '../../../components/AgentForm'

export const Route = createFileRoute('/_authed/dashboard/agents/$agentId')({
  component: EditAgent,
  validateSearch: (search: { tab?: string }) => ({ tab: search.tab }),
})

const WIDGET_URL = import.meta.env.DEV
  ? 'http://localhost:5173'
  : 'https://multi-tenant-chat-app.pages.dev'

function EditAgent() {
  const { agentId } = Route.useParams()
  const { tab } = Route.useSearch()
  const navigate = useNavigate()

  const agent = useQuery(api.agents.getByAgentId, { agentId })
  const updateAgent = useMutation(api.agents.update)
  const deleteAgent = useMutation(api.agents.remove)

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: AgentFormData) => {
    if (!agent) return
    setIsSubmitting(true)
    try {
      await updateAgent({
        id: agent._id,
        name: data.name,
        systemPrompt: data.systemPrompt,
        model: data.model,
        mcpServers: data.mcpServers.length > 0 ? JSON.stringify(data.mcpServers) : undefined,
        outputSchema: data.outputSchema || undefined,
        langfusePublicKey: data.langfuse.publicKey || undefined,
        langfuseSecretKey: data.langfuse.secretKey || undefined,
        langfuseHost: data.langfuse.host || undefined,
        langfusePromptName: data.langfuse.promptName || undefined,
        langfuseLabel: data.langfuse.label || undefined,
        allowedDomains: data.allowedDomains,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: '/dashboard/agents' })
  }

  const handleDelete = async () => {
    if (!agent) return
    await deleteAgent({ id: agent._id })
    navigate({ to: '/dashboard/agents' })
  }

  if (agent === undefined) {
    return (
      <div>
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (agent === null) {
    return (
      <div>
        <p className="text-red-600">Agent not found.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">
            Edit Agent
          </h2>
          <p className="mt-1 text-sm text-gray-500">ID: {agent.agentId}</p>
        </div>
        <a
          href={`${WIDGET_URL}/?agent=${agent.agentId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Preview widget
        </a>
      </div>

      <AgentForm
        initialData={{
          name: agent.name,
          systemPrompt: agent.systemPrompt ?? '',
          model: agent.model,
          mcpServers: agent.mcpServers,
          outputSchema: agent.outputSchema,
          langfuse: agent.langfuse,
          allowedDomains: agent.allowedDomains ?? ['*'],
        }}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onDelete={handleDelete}
        isSubmitting={isSubmitting}
        submitLabel="Save Changes"
        agentId={agent.agentId}
        agentDbId={agent._id}
        initialTab={tab}
      />
    </div>
  )
}
