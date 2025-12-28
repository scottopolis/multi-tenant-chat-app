/**
 * In-memory storage for chats and messages
 * 
 * TODO: Replace with persistent database
 * Options: Convex, Cloudflare D1, Turso, PlanetScale
 * 
 * This is a temporary solution for development. Data will be lost
 * when the worker restarts or is redeployed.
 * 
 * Architecture:
 * - Chats belong to an organization (orgId)
 * - Each chat is associated with a specific agent (agentId)
 * - One org can have multiple agents, each with their own chats
 */

export interface Chat {
  id: string;
  orgId: string;
  agentId: string;
  title?: string;
  createdAt: Date;
  // OpenAI Conversation API support (optional)
  conversationId?: string; // OpenAI conversation ID for server-side state
  lastResponseId?: string; // Last OpenAI response ID for chaining
}

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  // Optional metadata for tracing and debugging
  responseId?: string; // OpenAI response ID if applicable
  model?: string; // Model used for this response
}

// In-memory storage
const chats = new Map<string, Chat>();
const messages = new Map<string, Message[]>();

/**
 * Create a new chat for an organization and agent
 */
export function createChat(orgId: string, agentId: string, title?: string): Chat {
  const chat: Chat = {
    id: crypto.randomUUID(),
    orgId,
    agentId,
    title,
    createdAt: new Date(),
  };
  
  chats.set(chat.id, chat);
  messages.set(chat.id, []);
  
  return chat;
}

/**
 * Get a single chat with its messages
 * Returns null if the chat doesn't exist
 */
export function getChat(chatId: string): (Chat & { messages: Message[] }) | null {
  const chat = chats.get(chatId);
  if (!chat) {
    return null;
  }
  
  return {
    ...chat,
    messages: messages.get(chatId) || [],
  };
}

/**
 * List all chats for an organization
 * Optionally filter by agentId
 * Returns chats sorted by newest first
 */
export function listChats(orgId: string, agentId?: string): Chat[] {
  const orgChats = Array.from(chats.values())
    .filter(chat => {
      if (chat.orgId !== orgId) return false;
      if (agentId && chat.agentId !== agentId) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  
  return orgChats;
}

/**
 * Add a message to a chat
 * Returns the created message
 */
export function addMessage(
  chatId: string,
  data: { 
    role: Message['role']; 
    content: string;
    responseId?: string;
    model?: string;
  }
): Message {
  const message: Message = {
    id: crypto.randomUUID(),
    chatId,
    role: data.role,
    content: data.content,
    createdAt: new Date(),
    responseId: data.responseId,
    model: data.model,
  };
  
  const chatMessages = messages.get(chatId) || [];
  chatMessages.push(message);
  messages.set(chatId, chatMessages);
  
  return message;
}

/**
 * Get messages for a chat in AI SDK format
 * Returns array of { role, content } objects
 */
export function getMessages(chatId: string): Array<{ role: string; content: string }> {
  const chatMessages = messages.get(chatId) || [];
  return chatMessages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));
}

/**
 * Delete a chat and all its messages
 * Useful for testing and cleanup
 */
export function deleteChat(chatId: string): boolean {
  const deleted = chats.delete(chatId);
  messages.delete(chatId);
  return deleted;
}

/**
 * Update chat conversation state (for OpenAI Conversation API integration)
 * Useful for maintaining server-side conversation state
 */
export function updateChatConversationState(
  chatId: string,
  state: { conversationId?: string; lastResponseId?: string }
): boolean {
  const chat = chats.get(chatId);
  if (!chat) {
    return false;
  }
  
  if (state.conversationId !== undefined) {
    chat.conversationId = state.conversationId;
  }
  if (state.lastResponseId !== undefined) {
    chat.lastResponseId = state.lastResponseId;
  }
  
  chats.set(chatId, chat);
  return true;
}

/**
 * Clear all data (useful for testing)
 */
export function clearAll(): void {
  chats.clear();
  messages.clear();
}

