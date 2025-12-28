import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/agents/')({
  component: AgentsList,
})

function AgentsList() {
  // Placeholder data - will be replaced with real data later
  const agents = [
    { id: '1', name: 'Customer Support Agent', prompt: 'You are a helpful customer support agent...' },
    { id: '2', name: 'Sales Assistant', prompt: 'You are a sales assistant that helps customers...' },
  ]

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
                      System Prompt
                    </th>
                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Edit</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 bg-slate-800/50">
                  {agents.map((agent) => (
                    <tr key={agent.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-white sm:pl-6">
                        {agent.name}
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-400 max-w-md truncate">
                        {agent.prompt}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <Link
                          to="/dashboard/agents/$agentId"
                          params={{ agentId: agent.id }}
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
    </div>
  )
}
