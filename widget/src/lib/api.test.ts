/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock session module
vi.mock('./session', () => ({
  getSessionId: () => 'test-session-123',
  getClientContext: () => ({
    pageUrl: 'http://localhost:3000',
    referrer: '',
    userAgent: 'test-agent',
    locale: 'en-US',
    timezone: 'UTC',
  }),
}));

import { createChat, getChat, listChats, deleteChat } from './api';

describe('API Client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createChat', () => {
    it('creates a chat with sessionId and context', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'conv-123' }),
      });

      const result = await createChat({ title: 'Test Chat' }, 'my-agent');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chats?agent=my-agent'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test-session-123'),
        })
      );
      expect(result.id).toBe('conv-123');
    });

    it('throws on failed creation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
      });

      await expect(createChat({}, 'agent')).rejects.toThrow('Failed to create chat');
    });
  });

  describe('getChat', () => {
    it('fetches a chat by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'conv-123',
          messages: [{ id: 'm1', role: 'user', content: 'Hello' }],
        }),
      });

      const result = await getChat('conv-123', 'my-agent');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chats/conv-123?agent=my-agent'),
        expect.any(Object)
      );
      expect(result.id).toBe('conv-123');
      expect(result.messages).toHaveLength(1);
    });

    it('throws on 404', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(getChat('missing', 'agent')).rejects.toThrow('Failed to get chat');
    });
  });

  describe('listChats', () => {
    it('lists chats with sessionId parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chats: [
            { id: 'conv-1', title: 'Chat 1' },
            { id: 'conv-2', title: 'Chat 2' },
          ],
        }),
      });

      const result = await listChats('my-agent');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/sessionId=test-session-123/),
        expect.any(Object)
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('deleteChat', () => {
    it('sends DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await deleteChat('conv-123', 'my-agent');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/chats/conv-123?agent=my-agent'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('throws on failed deletion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      await expect(deleteChat('conv-123', 'agent')).rejects.toThrow('Failed to delete chat');
    });
  });

  describe('Authorization header', () => {
    it('includes API key in Authorization header when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ chats: [] }),
      });

      await listChats('my-agent', 'sk_test_key');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer sk_test_key',
          }),
        })
      );
    });

    it('omits Authorization header when no API key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ chats: [] }),
      });

      await listChats('my-agent');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers?.Authorization).toBeUndefined();
    });
  });
});
