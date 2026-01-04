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
      <div className="px-4 py-6 sm:px-0">
        <p className="text-white">Loading agents...</p>
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
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-3xl font-semibold text-white">Agents</h1>
          <p className="mt-2 text-sm text-gray-400">
            A list of all your configured AI agents.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <Link
            to="/dashboard/agents/new"
            className="block rounded-md bg-cyan-500 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-cyan-600"
          >
            Create Agent
          </Link>
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="mt-8 text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
          <svg
            className="mx-auto h-12 w-12 text-gray-500"
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
          <h3 className="mt-4 text-lg font-medium text-white">No agents yet</h3>
          <p className="mt-2 text-sm text-gray-400">
            Get started by creating your first AI agent.
          </p>
          <div className="mt-6">
            <Link
              to="/dashboard/agents/new"
              className="inline-flex items-center rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600"
            >
              Create your first agent
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 flow-root">
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-slate-700 rounded-lg">
                <table className="min-w-full divide-y divide-slate-700">
                  <thead className="bg-slate-800">
                    <tr>
                      <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-white sm:pl-6">
                        Name
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-white">
                        Model
                      </th>
                      <th className="px-3 py-3.5 text-left text-sm font-semibold text-white">
                        System Prompt
                      </th>
                      <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Edit</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700 bg-slate-800/50">
                    {agents.map((agent) => (
                      <tr key={agent._id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-6">
                          {agent.name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-400">
                          {agent.model}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-400 max-w-md truncate">
                          {agent.systemPrompt || '—'}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <Link
                            to="/dashboard/agents/$agentId"
                            params={{ agentId: agent.agentId }}
                            className="text-cyan-400 hover:text-cyan-300"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
