import { useUser } from '@clerk/tanstack-react-start'
import { useMutation } from 'convex/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTenant } from '../../lib/tenant'
import { api } from '../../../../convex-backend/convex/_generated/api'
import { MessageVolumeChart } from '../../components/UsageChart'
import { useQuery } from 'convex/react'
import { SetupChecklist } from '../../components/SetupChecklist'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import type { Id } from '../../../../convex-backend/convex/_generated/dataModel'

export const Route = createFileRoute('/_authed/dashboard/')({
  component: DashboardHome,
})

function DashboardHome() {
  const { tenant, isLoading } = useTenant()
  const { user } = useUser()
  const createTenant = useMutation(api.tenants.create)
  const tenantId = tenant?.id as Id<'tenants'> | undefined
  const agents = useQuery(api.agents.listByTenant, tenantId ? { tenantId } : 'skip')
  const apiKeys = useQuery(api.apiKeys.listByTenant, tenantId ? { tenantId } : 'skip')
  const usageStats = useQuery(api.conversations.getUsageStats, tenantId ? { tenantId } : 'skip')
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [provisionError, setProvisionError] = useState<string | null>(null)

  const provisionTenant = async () => {
    if (!user) return
    setIsProvisioning(true)
    setProvisionError(null)
    try {
      await createTenant({
        clerkUserId: user.id,
        name: user.fullName || user.primaryEmailAddress?.emailAddress || 'My Workspace',
      })
    } catch (error) {
      console.error('Failed to provision tenant:', error)
      setProvisionError(error instanceof Error ? error.message : 'Failed to set up workspace')
    }
    setIsProvisioning(false)
  }

  useEffect(() => {
    if (!isLoading && !tenant && user && !isProvisioning && !provisionError) {
      provisionTenant()
    }
  }, [isLoading, tenant, user, isProvisioning, provisionError])

  if (provisionError) {
    return (
      <div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md">
          <h3 className="text-red-800 font-medium mb-2">Setup Failed</h3>
          <p className="text-red-600 text-sm mb-4">{provisionError}</p>
          <button
            onClick={provisionTenant}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (isLoading || isProvisioning || !tenant) {
    return (
      <div>
        <p className="text-gray-500">
          {isProvisioning ? 'Setting up your workspace...' : 'Loading...'}
        </p>
      </div>
    )
  }

  const hasAgents = (agents?.length ?? 0) > 0
  const primaryAgent = agents?.[0]
  const hasSystemPrompt = agents?.some((agent) => (agent.systemPrompt ?? '').trim().length > 0) ?? false
  const hasApiKeys = (apiKeys?.filter((key) => !key.revokedAt).length ?? 0) > 0
  const hasRestrictedDomains =
    agents?.some((agent) => (agent.allowedDomains ?? ['*']).some((domain) => domain !== '*')) ?? false

  const checklistSteps = [
    {
      id: 'create-agent',
      title: 'Create your first agent',
      description: 'Define the agent name and basic capabilities.',
      status: hasAgents ? 'complete' : 'pending',
      to: '/dashboard/agents/new',
      cta: hasAgents ? 'Create another agent' : 'Create agent',
    },
    {
      id: 'system-prompt',
      title: 'Add a system prompt',
      description: 'Set guidance for sales/support tone and policy boundaries.',
      status: hasSystemPrompt ? 'complete' : 'pending',
      to: primaryAgent ? '/dashboard/agents/$agentId' : '/dashboard/agents',
      params: primaryAgent ? { agentId: primaryAgent.agentId } : undefined,
      cta: 'Edit prompt',
    },
    {
      id: 'api-key',
      title: 'Generate an API key',
      description: 'Keys authenticate widget traffic from your sites.',
      status: hasApiKeys ? 'complete' : 'pending',
      to: primaryAgent ? '/dashboard/agents/$agentId' : '/dashboard/agents',
      params: primaryAgent ? { agentId: primaryAgent.agentId } : undefined,
      hash: primaryAgent ? 'agent-embed' : undefined,
      cta: hasApiKeys ? 'Manage keys' : 'Create key',
    },
    {
      id: 'domain-allowlist',
      title: 'Lock down allowed domains',
      description: 'Limit which domains can embed your widget.',
      status: hasRestrictedDomains ? 'complete' : 'optional',
      to: primaryAgent ? '/dashboard/agents/$agentId' : '/dashboard/agents',
      params: primaryAgent ? { agentId: primaryAgent.agentId } : undefined,
      hash: primaryAgent ? 'agent-security' : undefined,
      cta: 'Update domains',
    },
    {
      id: 'install-widget',
      title: 'Install the widget',
      description: 'Copy the embed snippet and test it on your site.',
      status: hasAgents && hasApiKeys ? 'pending' : 'optional',
      to: primaryAgent ? '/dashboard/agents/$agentId' : '/dashboard/agents',
      params: primaryAgent ? { agentId: primaryAgent.agentId } : undefined,
      hash: primaryAgent ? 'agent-embed' : undefined,
      cta: 'View embed code',
    },
  ] as const

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">
            Welcome back, {tenant.name}
          </h2>
          <p className="text-gray-500">
            Track onboarding progress and keep your agents launch-ready.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/dashboard/agents/new"
            className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Create Agent
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader className="gap-1.5">
            <CardTitle>Account status</CardTitle>
            <CardDescription>Last 30 days of activity across your agents.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Conversations</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900 tabular-nums">
                  {usageStats ? usageStats.last30Conversations.toLocaleString() : '—'}
                </p>
                <p className="mt-1 text-xs text-gray-500">last 30 days</p>
              </div>
              <div className="rounded-lg border border-gray-200 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Messages</p>
                <p className="mt-2 text-2xl font-semibold text-gray-900 tabular-nums">
                  {usageStats ? usageStats.last30Messages.toLocaleString() : '—'}
                </p>
                <p className="mt-1 text-xs text-gray-500">last 30 days</p>
              </div>
            </div>
            <div className="mt-5 border-t border-gray-200 pt-4">
              <MessageVolumeChart stats={usageStats ?? null} height={220} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/dashboard/conversations"
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                View conversations
              </Link>
            </div>
          </CardContent>
        </Card>

        <SetupChecklist
          compact
          steps={checklistSteps.map((step) => ({
            ...step,
            status: step.status,
          }))}
        />
      </div>

    </div>
  )
}
