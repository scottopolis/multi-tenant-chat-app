import { describe, it, expect, beforeEach } from 'vitest';
import { getSessionId, clearSessionId, getClientContext } from './session';

describe('Session Management', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getSessionId', () => {
    it('creates and stores a new session ID when none exists', () => {
      const sessionId = getSessionId();
      
      expect(sessionId).toBeDefined();
      expect(sessionId.length).toBeGreaterThan(0);
      expect(localStorage.getItem('chat-assistant-session-id')).toBe(sessionId);
    });

    it('returns existing session ID from localStorage', () => {
      const existingId = 'existing-session-id-123';
      localStorage.setItem('chat-assistant-session-id', existingId);
      
      const sessionId = getSessionId();
      
      expect(sessionId).toBe(existingId);
    });

    it('returns consistent session ID across multiple calls', () => {
      const first = getSessionId();
      const second = getSessionId();
      const third = getSessionId();
      
      expect(first).toBe(second);
      expect(second).toBe(third);
    });
  });

  describe('clearSessionId', () => {
    it('removes session ID from localStorage', () => {
      getSessionId(); // Create one first
      expect(localStorage.getItem('chat-assistant-session-id')).not.toBeNull();
      
      clearSessionId();
      
      expect(localStorage.getItem('chat-assistant-session-id')).toBeNull();
    });

    it('creates new session ID after clearing', () => {
      const first = getSessionId();
      clearSessionId();
      const second = getSessionId();
      
      expect(first).not.toBe(second);
    });
  });

  describe('getClientContext', () => {
    it('returns client context with expected fields', () => {
      const context = getClientContext();
      
      expect(context).toHaveProperty('pageUrl');
      expect(context).toHaveProperty('referrer');
      expect(context).toHaveProperty('userAgent');
      expect(context).toHaveProperty('locale');
      expect(context).toHaveProperty('timezone');
    });

    it('captures current page URL', () => {
      const context = getClientContext();
      
      expect(context.pageUrl).toBe(window.location.href);
    });

    it('captures browser locale', () => {
      const context = getClientContext();
      
      expect(context.locale).toBe(navigator.language);
    });
  });
});
