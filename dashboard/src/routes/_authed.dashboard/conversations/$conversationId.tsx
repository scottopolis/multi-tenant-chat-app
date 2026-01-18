import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { api } from '../../../../../convex-backend/convex/_generated/api'
import { useTenant } from '../../../lib/tenant'
import type { Id } from '../../../../../convex-backend/convex/_generated/dataModel'

export const Route = createFileRoute(
  '/_authed/dashboard/conversations/$conversationId'
)({
  component: ConversationViewer,
})

type ConversationEvent = {
  seq: number
  eventType: 'message' | 'tool_call' | 'tool_result' | 'system' | 'error'
  role?: 'user' | 'assistant' | 'system' | 'tool'
  content?: string
  model?: string
  toolName?: string
  toolCallId?: string
  toolInput?: unknown
  toolResult?: unknown
  errorType?: string
  errorMessage?: string
  createdAt: number
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function EventBubble({ event }: { event: ConversationEvent }) {
  switch (event.eventType) {
    case 'message':
      return <MessageBubble event={event} />
    case 'tool_call':
      return <ToolCallBubble event={event} />
    case 'tool_result':
      return <ToolResultBubble event={event} />
    case 'error':
      return <ErrorBubble event={event} />
    case 'system':
      return <SystemBubble event={event} />
    default:
      return null
  }
}

function MessageBubble({ event }: { event: ConversationEvent }) {
  const isUser = event.role === 'user'
  const isAssistant = event.role === 'assistant'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-lg px-4 py-2 ${
          isUser
            ? 'bg-gray-900 text-white'
            : isAssistant
              ? 'bg-gray-100 text-gray-900'
              : 'bg-blue-50 text-blue-900'
        }`}
      >
        <div className="text-xs opacity-60 mb-1">
          {event.role} • {formatTimestamp(event.createdAt)}
        </div>
        <div className="whitespace-pre-wrap break-words">{event.content}</div>
        {event.model && (
          <div className="text-xs opacity-50 mt-1">{event.model}</div>
        )}
      </div>
    </div>
  )
}

function ToolCallBubble({ event }: { event: ConversationEvent }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[75%] rounded-lg px-4 py-2 bg-amber-50 border border-amber-200">
        <div className="text-xs text-amber-700 mb-1">
          Tool Call • {formatTimestamp(event.createdAt)}
        </div>
        <div className="font-mono text-sm text-amber-900">
          {event.toolName}
        </div>
        {event.toolInput && (
          <pre className="mt-2 text-xs bg-amber-100 p-2 rounded overflow-x-auto">
            {JSON.stringify(event.toolInput, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

function ToolResultBubble({ event }: { event: ConversationEvent }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[75%] rounded-lg px-4 py-2 bg-green-50 border border-green-200">
        <div className="text-xs text-green-700 mb-1">
          Tool Result • {formatTimestamp(event.createdAt)}
        </div>
        <div className="font-mono text-sm text-green-900">{event.toolName}</div>
        {event.toolResult && (
          <pre className="mt-2 text-xs bg-green-100 p-2 rounded overflow-x-auto max-h-48 overflow-y-auto">
            {typeof event.toolResult === 'string'
              ? event.toolResult
              : JSON.stringify(event.toolResult, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

function ErrorBubble({ event }: { event: ConversationEvent }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[75%] rounded-lg px-4 py-2 bg-red-50 border border-red-200">
        <div className="text-xs text-red-700 mb-1">
          Error • {formatTimestamp(event.createdAt)}
        </div>
        <div className="text-sm text-red-900">
          {event.errorType && (
            <span className="font-medium">{event.errorType}: </span>
          )}
          {event.errorMessage || event.content}
        </div>
      </div>
    </div>
  )
}

function SystemBubble({ event }: { event: ConversationEvent }) {
  return (
    <div className="flex justify-center">
      <div className="rounded-full px-3 py-1 bg-gray-100 text-xs text-gray-500">
        {event.content} • {formatTimestamp(event.createdAt)}
      </div>
    </div>
  )
}

function MetadataPanel({
  conversation,
}: {
  conversation: {
    _id: Id<'conversations'>
    sessionId: string
    userId?: string | null
    context?: {
      pageUrl?: string
      referrer?: string
      userAgent?: string
      locale?: string
      timezone?: string
    } | null
    createdAt: number
    lastEventAt: number
    agentName: string
    agentStringId: string | null
    status?: 'active' | 'archived' | null
  }
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-6">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        Conversation Details
      </h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-gray-500">Agent</dt>
        <dd className="text-gray-900">{conversation.agentName}</dd>

        <dt className="text-gray-500">Status</dt>
        <dd className="text-gray-900">{conversation.status ?? 'active'}</dd>

        <dt className="text-gray-500">Session ID</dt>
        <dd className="text-gray-900 font-mono text-xs truncate">
          {conversation.sessionId}
        </dd>

        {conversation.userId && (
          <>
            <dt className="text-gray-500">User ID</dt>
            <dd className="text-gray-900 font-mono text-xs truncate">
              {conversation.userId}
            </dd>
          </>
        )}

        <dt className="text-gray-500">Created</dt>
        <dd className="text-gray-900">
          {new Date(conversation.createdAt).toLocaleString()}
        </dd>

        <dt className="text-gray-500">Last Activity</dt>
        <dd className="text-gray-900">
          {new Date(conversation.lastEventAt).toLocaleString()}
        </dd>

        {conversation.context?.pageUrl && (
          <>
            <dt className="text-gray-500">Page URL</dt>
            <dd className="text-gray-900 truncate">
              {conversation.context.pageUrl}
            </dd>
          </>
        )}

        {conversation.context?.locale && (
          <>
            <dt className="text-gray-500">Locale</dt>
            <dd className="text-gray-900">{conversation.context.locale}</dd>
          </>
        )}

        {conversation.context?.timezone && (
          <>
            <dt className="text-gray-500">Timezone</dt>
            <dd className="text-gray-900">{conversation.context.timezone}</dd>
          </>
        )}
      </dl>
    </div>
  )
}

function ConversationViewer() {
  const { conversationId } = Route.useParams()
  const { tenant, isLoading: tenantLoading } = useTenant()

  const conversation = useQuery(
    api.conversations.getForDashboard,
    tenant
      ? {
          tenantId: tenant.id as Id<'tenants'>,
          conversationId: conversationId as Id<'conversations'>,
        }
      : 'skip'
  )

  if (tenantLoading || conversation === undefined) {
    return (
      <div>
        <p className="text-gray-500">Loading conversation...</p>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div>
        <p className="text-red-600">
          No tenant found. Please run the seed script.
        </p>
      </div>
    )
  }

  if (conversation === null) {
    return (
      <div>
        <Link
          to="/dashboard/conversations"
          className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-block"
        >
          ← Back to Conversations
        </Link>
        <p className="text-red-600">Conversation not found.</p>
      </div>
    )
  }

  return (
    <div>
      <Link
        to="/dashboard/conversations"
        className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-block"
      >
        ← Back to Conversations
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {conversation.title || 'Conversation Transcript'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {conversation.events.length} events •{' '}
          {conversation.events.filter((e) => e.eventType === 'message').length}{' '}
          messages
        </p>
      </div>

      <MetadataPanel conversation={conversation} />

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="space-y-4">
          {conversation.events.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              No events in this conversation.
            </p>
          ) : (
            conversation.events.map((event) => (
              <EventBubble key={event.seq} event={event} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
