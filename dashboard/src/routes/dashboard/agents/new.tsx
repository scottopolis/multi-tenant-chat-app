import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../../../convex-backend/convex/_generated/api'
import { useTenant } from '../../../lib/tenant'
import { AgentForm, type AgentFormData } from '../../../components/AgentForm'

export const Route = createFileRoute('/dashboard/agents/new')({
  component: NewAgent,
})

function NewAgent() {
  const navigate = useNavigate()
  const { tenant, isLoading: tenantLoading } = useTenant()
  const createAgent = useMutation(api.agents.create)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: AgentFormData) => {
    if (!tenant) return

    setIsSubmitting(true)
    try {
      const agentId = data.name.toLowerCase().replace(/\s+/g, '-')
      await createAgent({
        agentId,
        tenantId: tenant.id as any,
        orgId: tenant.clerkOrgId,
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
      })
      navigate({ to: '/dashboard/agents' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: '/dashboard/agents' })
  }

  if (tenantLoading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <p className="text-white">Loading...</p>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <p className="text-red-400">No tenant found. Please run the seed script.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="min-w-0 flex-1">
          <h2 className="text-3xl font-bold leading-7 text-white sm:truncate sm:tracking-tight">
            Create New Agent
          </h2>
        </div>
      </div>

      <AgentForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isSubmitting}
        submitLabel="Create Agent"
      />
    </div>
  )
}
