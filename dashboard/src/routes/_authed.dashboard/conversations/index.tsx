import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../../../convex-backend/convex/_generated/api'
import { useTenant } from '../../../lib/tenant'
import {
  formatRelativeDate,
  getConversationPreview,
  getMessageCount,
} from '../../../lib/conversations'

export const Route = createFileRoute('/_authed/dashboard/conversations/')({
  component: ConversationsList,
})

function ConversationsList() {
  const { tenant, isLoading: tenantLoading } = useTenant()

  const conversations = useQuery(
    api.conversations.listByTenant,
    tenant ? { tenantId: tenant.id as any } : 'skip'
  )

  const agents = useQuery(
    api.agents.listByTenant,
    tenant ? { tenantId: tenant.id as any } : 'skip'
  )

  const isLoading = tenantLoading || conversations === undefined

  if (isLoading) {
    return (
      <div>
        <p className="text-gray-500">Loading conversations...</p>
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

  const agentMap = new Map(agents?.map((a) => [a._id, a]) ?? [])

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Conversations</h1>
          <p className="mt-1 text-sm text-gray-500">
            View all conversations across your agents.
          </p>
        </div>
      </div>

      {conversations.length === 0 ? (
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
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <h3 className="mt-4 text-base font-medium text-gray-900">No conversations yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Conversations will appear here once users start chatting with your agents.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 pl-6 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Preview
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Messages
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Activity
                </th>
                <th className="relative py-3 pl-3 pr-6">
                  <span className="sr-only">View</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {conversations.map((conversation) => {
                const agent = agentMap.get(conversation.agentId)
                return (
                  <tr
                    key={conversation._id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-4 pl-6 pr-3 text-sm text-gray-900 max-w-xs truncate">
                      {conversation.title || getConversationPreview(conversation.events)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {agent?.name ?? 'Unknown'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {getMessageCount(conversation.events)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {formatRelativeDate(conversation.lastEventAt)}
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm">
                      <Link
                        to="/dashboard/conversations/$conversationId"
                        params={{ conversationId: conversation._id }}
                        className="text-gray-900 hover:text-gray-600 font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
