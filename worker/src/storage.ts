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
}

export interface Message {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
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
  data: { role: Message['role']; content: string }
): Message {
  const message: Message = {
    id: crypto.randomUUID(),
    chatId,
    role: data.role,
    content: data.content,
    createdAt: new Date(),
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
 * Clear all data (useful for testing)
 */
export function clearAll(): void {
  chats.clear();
  messages.clear();
}

