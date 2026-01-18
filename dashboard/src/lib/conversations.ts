export type ConversationEvent = {
  eventType: string
  role?: string
  content?: string
}

export function formatRelativeDate(timestamp: number, now: Date = new Date()): string {
  const date = new Date(timestamp)
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'short' })
  } else {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  }
}

export function getConversationPreview(events: ConversationEvent[]): string {
  const firstUserMessage = events.find(
    (e) => e.eventType === 'message' && e.role === 'user' && e.content
  )
  return firstUserMessage?.content ?? 'No messages'
}

export function getMessageCount(events: { eventType: string }[]): number {
  return events.filter((e) => e.eventType === 'message').length
}
