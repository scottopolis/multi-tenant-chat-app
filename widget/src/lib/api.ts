/**
 * API Client for Chat Assistant
 * 
 * Supports API key authentication via Authorization header.
 * API keys are passed from embed.js via postMessage to the widget.
 */

import { getSessionId, getClientContext } from './session';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export interface Chat {
  id: string;
  orgId?: string;
  title?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  toolEventType?: 'tool_call' | 'tool_result';
  toolName?: string;
  toolCallId?: string;
  toolInput?: unknown;
  toolResult?: unknown;
}

export interface ChatWithMessages extends Chat {
  messages: Message[];
}

export interface ClientContext {
  pageUrl?: string;
  referrer?: string;
  userAgent?: string;
  locale?: string;
  timezone?: string;
  customMetadata?: unknown;
}

export interface CreateChatRequest {
  sessionId: string;
  userId?: string;
  title?: string;
  context?: ClientContext;
}

export interface SendMessageRequest {
  content: string;
  model?: string;
}

function buildHeaders(apiKey?: string, contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

/**
 * Create a new chat
 * 
 * Automatically includes sessionId and client context.
 */
export async function createChat(
  options?: { title?: string; customMetadata?: unknown },
  agentId: string = 'default',
  apiKey?: string
): Promise<Chat> {
  const sessionId = getSessionId();
  const clientContext = getClientContext();

  const data: CreateChatRequest = {
    sessionId,
    title: options?.title,
    context: {
      ...clientContext,
      customMetadata: options?.customMetadata,
    },
  };

  const response = await fetch(`${API_URL}/api/chats?agent=${agentId}`, {
    method: 'POST',
    headers: buildHeaders(apiKey, 'application/json'),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to create chat: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get a single chat with its messages
 */
export async function getChat(chatId: string, agentId: string = 'default', apiKey?: string): Promise<ChatWithMessages> {
  const response = await fetch(`${API_URL}/api/chats/${chatId}?agent=${agentId}`, {
    headers: buildHeaders(apiKey),
  });

  if (!response.ok) {
    throw new Error(`Failed to get chat: ${response.statusText}`);
  }

  return response.json();
}

export interface ChatListItem {
  id: string;
  title: string;
  status?: string;
  preview: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * List all chats for the current session
 */
export async function listChats(agentId: string = 'default', apiKey?: string): Promise<ChatListItem[]> {
  const sessionId = getSessionId();
  const response = await fetch(`${API_URL}/api/chats?agent=${agentId}&sessionId=${encodeURIComponent(sessionId)}`, {
    headers: buildHeaders(apiKey),
  });

  if (!response.ok) {
    throw new Error(`Failed to list chats: ${response.statusText}`);
  }

  const data = await response.json();
  return data.chats;
}

/**
 * Delete a chat permanently
 */
export async function deleteChat(chatId: string, agentId: string = 'default', apiKey?: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/chats/${chatId}?agent=${agentId}`, {
    method: 'DELETE',
    headers: buildHeaders(apiKey),
  });

  if (!response.ok) {
    throw new Error(`Failed to delete chat: ${response.statusText}`);
  }
}

/**
 * Send a message and return an EventSource for streaming
 */
export function sendMessage(
  chatId: string,
  _data: SendMessageRequest
): EventSource {
  // For SSE with POST, we need to use a different approach
  // Create URL with query params for SSE connection
  const url = new URL(`${API_URL}/api/chats/${chatId}/messages`);
  
  // We'll use fetch to POST, then connect via EventSource
  // Note: This is a simplified version. In production, you might want to
  // use a library that supports POST with EventSource, or implement
  // a custom SSE client.
  
  // For now, we'll return a mock EventSource that we'll populate
  // The actual implementation will be in the useChat hook
  return new EventSource(url.toString());
}

/**
 * Send a message using fetch for SSE streaming
 * Returns an async iterator of text chunks
 * 
 * Handles TanStack AI SSE format:
 * - data: {"type":"content","delta":"text chunk",...}
 * - data: {"type":"done",...}
 * - data: [DONE]
 */
export async function* streamMessage(
  chatId: string,
  data: SendMessageRequest,
  agentId: string = 'default',
  apiKey?: string
): AsyncGenerator<{ event: string; data: string }, void, unknown> {
  const response = await fetch(`${API_URL}/api/chats/${chatId}/messages?agent=${agentId}`, {
    method: 'POST',
    headers: buildHeaders(apiKey, 'application/json'),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        
        if (line.startsWith('data:')) {
          const rawData = line.slice(5).trim();
          
          // Handle end of stream
          if (rawData === '[DONE]') {
            yield { event: 'done', data: '' };
            continue;
          }
          
          // Parse TanStack AI JSON format
          try {
            const parsed = JSON.parse(rawData);
            
            if (parsed.type === 'content' && parsed.delta) {
              // Content chunk - yield the delta text
              yield { event: 'text', data: parsed.delta };
            } else if (parsed.type === 'tool_call') {
              // Tool call event
              yield { event: 'tool_call', data: JSON.stringify(parsed) };
            } else if (parsed.type === 'tool_result') {
              // Tool result event
              yield { event: 'tool_result', data: JSON.stringify(parsed) };
            } else if (parsed.type === 'done') {
              // Stream complete
              yield { event: 'done', data: '' };
            } else if (parsed.type === 'error') {
              // Error from server
              yield { event: 'error', data: JSON.stringify({ error: parsed.message || 'Unknown error' }) };
            }
            // Ignore other chunk types (thinking, etc. for now)
          } catch {
            // If not JSON, treat as raw text (legacy format)
            yield { event: 'text', data: rawData };
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Get available models
 */
export async function getModels(agentId: string = 'default', apiKey?: string): Promise<Array<{ name: string; description: string }>> {
  const response = await fetch(`${API_URL}/api/models?agent=${agentId}`, {
    headers: buildHeaders(apiKey),
  });

  if (!response.ok) {
    throw new Error(`Failed to get models: ${response.statusText}`);
  }

  const data = await response.json();
  return data.models;
}
