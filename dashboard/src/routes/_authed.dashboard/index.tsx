import { useUser } from '@clerk/tanstack-react-start'
import { useMutation } from 'convex/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTenant } from '../../lib/tenant'
import { api } from '../../../../convex-backend/convex/_generated/api'
import { UsageChart } from '../../components/UsageChart'
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
      href: '/dashboard/agents/new',
      cta: hasAgents ? 'Create another agent' : 'Create agent',
    },
    {
      id: 'system-prompt',
      title: 'Add a system prompt',
      description: 'Set guidance for sales/support tone and policy boundaries.',
      status: hasSystemPrompt ? 'complete' : 'pending',
      href: primaryAgent ? `/dashboard/agents/${primaryAgent.agentId}` : '/dashboard/agents',
      cta: 'Edit prompt',
    },
    {
      id: 'api-key',
      title: 'Generate an API key',
      description: 'Keys authenticate widget traffic from your sites.',
      status: hasApiKeys ? 'complete' : 'pending',
      href: primaryAgent ? `/dashboard/agents/${primaryAgent.agentId}?tab=Embed` : '/dashboard/agents',
      cta: hasApiKeys ? 'Manage keys' : 'Create key',
    },
    {
      id: 'domain-allowlist',
      title: 'Lock down allowed domains',
      description: 'Limit which domains can embed your widget.',
      status: hasRestrictedDomains ? 'complete' : 'optional',
      href: primaryAgent ? `/dashboard/agents/${primaryAgent.agentId}?tab=Security` : '/dashboard/agents',
      cta: 'Update domains',
    },
    {
      id: 'install-widget',
      title: 'Install the widget',
      description: 'Copy the embed snippet and test it on your site.',
      status: hasAgents && hasApiKeys ? 'pending' : 'optional',
      href: primaryAgent ? `/dashboard/agents/${primaryAgent.agentId}?tab=Embed` : '/dashboard/agents',
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
          <Link
            to="/dashboard/conversations"
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            View Conversations
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <SetupChecklist
          steps={checklistSteps.map((step) => ({
            ...step,
            status: step.status,
          }))}
        />

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Next best action</CardTitle>
              <CardDescription>
                Recommended focus for invite-only onboarding.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <p>
                {hasAgents
                  ? 'Polish your system prompt and verify the embed works on a staging page.'
                  : 'Create your first agent and define a sales/support prompt.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={hasAgents ? `/dashboard/agents/${primaryAgent?.agentId}` : '/dashboard/agents/new'}
                  className="inline-flex items-center rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
                >
                  {hasAgents ? 'Open agent' : 'Create agent'}
                </Link>
                <Link
                  to="/dashboard/agents"
                  className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Review agents
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invite-only beta</CardTitle>
              <CardDescription>Operational reminders before inviting customers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-600">
              <ul className="space-y-2">
                <li>• Set allowed domains for each customer site.</li>
                <li>• Verify at least one test conversation per agent.</li>
                <li>• Share support contact details with pilot customers.</li>
              </ul>
              <Link
                to="/dashboard/agents"
                className="inline-flex items-center text-sm font-medium text-gray-900 hover:text-gray-600"
              >
                Review agent settings
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <UsageChart />
    </div>
  )
}
