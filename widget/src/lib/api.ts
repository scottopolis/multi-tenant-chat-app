/**
 * API Client for Chat Assistant
 * 
 * TODO: Add auth header injection
 * - Accept auth token from props or context
 * - Include Authorization: Bearer <token> header in all requests
 * - Handle token refresh on 401 responses
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

export interface Chat {
  id: string;
  orgId: string;
  title?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface ChatWithMessages extends Chat {
  messages: Message[];
}

export interface CreateChatRequest {
  title?: string;
}

export interface SendMessageRequest {
  content: string;
  model?: string;
}

/**
 * Create a new chat
 */
export async function createChat(data?: CreateChatRequest): Promise<Chat> {
  const response = await fetch(`${API_URL}/api/chats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // TODO: Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data || {}),
  });

  if (!response.ok) {
    throw new Error(`Failed to create chat: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get a single chat with its messages
 */
export async function getChat(chatId: string): Promise<ChatWithMessages> {
  const response = await fetch(`${API_URL}/api/chats/${chatId}`, {
    headers: {
      // TODO: Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get chat: ${response.statusText}`);
  }

  return response.json();
}

/**
 * List all chats
 */
export async function listChats(): Promise<Chat[]> {
  const response = await fetch(`${API_URL}/api/chats`, {
    headers: {
      // TODO: Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list chats: ${response.statusText}`);
  }

  const data = await response.json();
  return data.chats;
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
 */
export async function* streamMessage(
  chatId: string,
  data: SendMessageRequest
): AsyncGenerator<{ event: string; data: string }, void, unknown> {
  const response = await fetch(`${API_URL}/api/chats/${chatId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // TODO: Authorization: `Bearer ${token}`,
    },
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
        if (line.startsWith('event:')) {
          // Event type line, will be parsed with data line below
          continue;
        }
        
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          const eventMatch = lines[lines.indexOf(line) - 1];
          const event = eventMatch?.startsWith('event:') 
            ? eventMatch.slice(6).trim() 
            : 'message';
          
          yield { event, data };
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
export async function getModels(): Promise<Array<{ name: string; description: string }>> {
  const response = await fetch(`${API_URL}/api/models`, {
    headers: {
      // TODO: Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get models: ${response.statusText}`);
  }

  const data = await response.json();
  return data.models;
}

