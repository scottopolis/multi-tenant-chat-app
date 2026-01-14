import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../../../convex-backend/convex/_generated/api'
import { AgentForm, type AgentFormData } from '../../../components/AgentForm'

export const Route = createFileRoute('/_authed/dashboard/agents/$agentId')({
  component: EditAgent,
})

function EditAgent() {
  const { agentId } = Route.useParams()
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
      navigate({ to: '/dashboard/agents' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: '/dashboard/agents' })
  }

  const handleDelete = async () => {
    if (!agent) return
    if (window.confirm('Are you sure you want to delete this agent?')) {
      await deleteAgent({ id: agent._id })
      navigate({ to: '/dashboard/agents' })
    }
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
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900">
          Edit Agent
        </h2>
        <p className="mt-1 text-sm text-gray-500">ID: {agent.agentId}</p>
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
      />
    </div>
  )
}
