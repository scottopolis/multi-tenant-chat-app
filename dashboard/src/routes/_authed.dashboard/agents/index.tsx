import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../../../convex-backend/convex/_generated/api'
import { useTenant } from '../../../lib/tenant'

export const Route = createFileRoute('/_authed/dashboard/agents/')({
  component: AgentsList,
})

function AgentsList() {
  const { tenant, isLoading: tenantLoading } = useTenant()

  const agents = useQuery(
    api.agents.listByTenant,
    tenant ? { tenantId: tenant.id as any } : 'skip'
  )

  const isLoading = tenantLoading || agents === undefined

  if (isLoading) {
    return (
      <div>
        <p className="text-gray-500">Loading agents...</p>
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
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Agents</h1>
          <p className="mt-1 text-sm text-gray-500">
            A list of all your configured AI agents.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link
            to="/dashboard/agents/new"
            className="inline-flex items-center px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Create Agent
          </Link>
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611l-.628.105a9.002 9.002 0 01-10.214 0l-.628-.105c-1.717-.293-2.3-2.379-1.067-3.611L5 14.5"
            />
          </svg>
          <h3 className="mt-4 text-base font-medium text-gray-900">No agents yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by creating your first AI agent.
          </p>
          <div className="mt-6">
            <Link
              to="/dashboard/agents/new"
              className="inline-flex items-center px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Create your first agent
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 pl-6 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Model
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  System Prompt
                </th>
                <th className="relative py-3 pl-3 pr-6">
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {agents.map((agent) => (
                <tr key={agent._id} className="hover:bg-gray-50 transition-colors">
                  <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-gray-900">
                    {agent.name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {agent.model}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">
                    {agent.systemPrompt && (agent.allowedDomains ?? ['*']).some((domain) => domain !== '*') ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Needs setup
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-500 max-w-md truncate">
                    {agent.systemPrompt || '—'}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm">
                    <Link
                      to="/dashboard/agents/$agentId"
                      params={{ agentId: agent.agentId }}
                      className="text-gray-900 hover:text-gray-600 font-medium"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
