import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../../../convex-backend/convex/_generated/api'
import { useTenant } from '../../../lib/tenant'
import { AgentForm, type AgentFormData } from '../../../components/AgentForm'
import type { Id } from '../../../../../convex-backend/convex/_generated/dataModel'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'

const DEFAULT_VOICE_CONFIG = {
  voiceModel: 'gpt-realtime',
  voiceName: 'verse',
  locale: 'en-US',
  bargeInEnabled: true,
}

export const Route = createFileRoute('/_authed/dashboard/agents/new')({
  component: NewAgent,
})

function NewAgent() {
  const navigate = useNavigate()
  const { tenant, isLoading: tenantLoading } = useTenant()
  const createAgent = useMutation(api.agents.create)
  const createVoiceAgent = useMutation(api.voiceAgents.create)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (data: AgentFormData) => {
    if (!tenant) return

    setIsSubmitting(true)
    try {
      const agentId = data.name.toLowerCase().replace(/\s+/g, '-')
      const newAgentId = await createAgent({
        agentId,
        tenantId: tenant.id as Id<'tenants'>,
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
        allowedDomains: data.allowedDomains,
      })

      await createVoiceAgent({
        tenantId: tenant.id as Id<'tenants'>,
        agentId: newAgentId,
        voiceModel: DEFAULT_VOICE_CONFIG.voiceModel,
        voiceName: DEFAULT_VOICE_CONFIG.voiceName,
        locale: DEFAULT_VOICE_CONFIG.locale,
        bargeInEnabled: DEFAULT_VOICE_CONFIG.bargeInEnabled,
        enabled: true,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: '/dashboard/agents' })
  }

  if (tenantLoading) {
    return (
      <div>
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div>
        <p className="text-red-600">No tenant found. Please run the seed script.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900">
          Create New Agent
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          Build a sales or support assistant in minutes. You can refine tools and voice after launch.
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>What you need to launch</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          <ul className="space-y-2">
            <li>• Pick a name and add a clear system prompt.</li>
            <li>• Select a model that matches your response quality needs.</li>
            <li>• Voice is enabled by default. Configure Twilio when you are ready.</li>
          </ul>
        </CardContent>
      </Card>

      <AgentForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isSubmitting={isSubmitting}
        submitLabel="Create Agent"
      />
    </div>
  )
}
