import { describe, it, expect, beforeEach } from 'vitest';
import { createChat, getChat, listChats, addMessage, getMessages, clearAll } from './storage';

/**
 * Storage unit tests - testing complex business logic for multi-tenant chat management
 * Focus: Core CRUD operations and data integrity
 */
describe('Storage', () => {
  beforeEach(() => {
    clearAll();
  });

  describe('Multi-tenant chat isolation', () => {
    it('should isolate chats by organization', () => {
      createChat('org-123', 'agent-1');
      createChat('org-123', 'agent-1');
      createChat('org-456', 'agent-2');
      
      const org123Chats = listChats('org-123');
      const org456Chats = listChats('org-456');
      
      expect(org123Chats).toHaveLength(2);
      expect(org456Chats).toHaveLength(1);
    });

    it('should filter chats by agent within same org', () => {
      createChat('org-123', 'agent-1');
      createChat('org-123', 'agent-1');
      createChat('org-123', 'agent-2');
      
      const agent1Chats = listChats('org-123', 'agent-1');
      const agent2Chats = listChats('org-123', 'agent-2');
      const allOrgChats = listChats('org-123');
      
      expect(agent1Chats).toHaveLength(2);
      expect(agent2Chats).toHaveLength(1);
      expect(allOrgChats).toHaveLength(3);
    });
  });

  describe('Message lifecycle', () => {
    it('should handle full message flow: create chat, add messages, retrieve in AI format', () => {
      const chat = createChat('org-123', 'agent-1');
      
      addMessage(chat.id, { role: 'user', content: 'Hello' });
      addMessage(chat.id, { role: 'assistant', content: 'Hi there!' });
      
      const messages = getMessages(chat.id);
      const retrieved = getChat(chat.id);
      
      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({ role: 'user', content: 'Hello' });
      expect(retrieved?.messages).toHaveLength(2);
    });
  });
});

