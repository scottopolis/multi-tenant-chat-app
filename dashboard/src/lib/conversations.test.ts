import { describe, it, expect } from 'vitest'
import {
  formatRelativeDate,
  getConversationPreview,
  getMessageCount,
} from './conversations'

describe('formatRelativeDate', () => {
  const baseTime = new Date('2024-06-15T14:30:00Z')

  it('shows time for today', () => {
    const twoHoursAgo = new Date(baseTime.getTime() - 2 * 60 * 60 * 1000)
    const result = formatRelativeDate(twoHoursAgo.getTime(), baseTime)
    expect(result).toMatch(/\d{1,2}:\d{2}/)
  })

  it('shows "Yesterday" for yesterday', () => {
    const timestamp = new Date('2024-06-14T10:00:00Z').getTime()
    expect(formatRelativeDate(timestamp, baseTime)).toBe('Yesterday')
  })

  it('shows weekday for 2-6 days ago', () => {
    const timestamp = new Date('2024-06-12T10:00:00Z').getTime()
    const result = formatRelativeDate(timestamp, baseTime)
    expect(result).toMatch(/Wed|Wednesday/i)
  })

  it('shows month and day for 7+ days ago', () => {
    const timestamp = new Date('2024-06-01T10:00:00Z').getTime()
    const result = formatRelativeDate(timestamp, baseTime)
    expect(result).toMatch(/Jun|June/)
    expect(result).toMatch(/1/)
  })
})

describe('getConversationPreview', () => {
  it('returns first user message content', () => {
    const events = [
      { eventType: 'message', role: 'user', content: 'Hello there' },
      { eventType: 'message', role: 'assistant', content: 'Hi!' },
    ]
    expect(getConversationPreview(events)).toBe('Hello there')
  })

  it('skips assistant messages to find user message', () => {
    const events = [
      { eventType: 'message', role: 'assistant', content: 'Welcome!' },
      { eventType: 'message', role: 'user', content: 'Thanks' },
    ]
    expect(getConversationPreview(events)).toBe('Thanks')
  })

  it('skips tool events', () => {
    const events = [
      { eventType: 'tool_call', toolName: 'search' },
      { eventType: 'message', role: 'user', content: 'Search for X' },
    ]
    expect(getConversationPreview(events)).toBe('Search for X')
  })

  it('returns "No messages" for empty events', () => {
    expect(getConversationPreview([])).toBe('No messages')
  })

  it('returns "No messages" when no user messages exist', () => {
    const events = [
      { eventType: 'message', role: 'assistant', content: 'Hello' },
    ]
    expect(getConversationPreview(events)).toBe('No messages')
  })
})

describe('getMessageCount', () => {
  it('counts only message events', () => {
    const events = [
      { eventType: 'message' },
      { eventType: 'tool_call' },
      { eventType: 'message' },
      { eventType: 'tool_result' },
      { eventType: 'message' },
    ]
    expect(getMessageCount(events)).toBe(3)
  })

  it('returns 0 for empty events', () => {
    expect(getMessageCount([])).toBe(0)
  })

  it('returns 0 when no message events', () => {
    const events = [{ eventType: 'tool_call' }, { eventType: 'error' }]
    expect(getMessageCount(events)).toBe(0)
  })
})
