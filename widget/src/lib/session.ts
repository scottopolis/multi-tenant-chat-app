/**
 * Session management for anonymous users
 *
 * Generates and stores a unique sessionId in localStorage.
 * Used to track conversations for anonymous users across page loads.
 */

const SESSION_KEY = 'chat-assistant-session-id';

/**
 * Get or create a session ID
 * Returns existing sessionId from localStorage or creates a new one
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') {
    return crypto.randomUUID();
  }

  let sessionId = localStorage.getItem(SESSION_KEY);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  return sessionId;
}

/**
 * Clear the session ID
 * Useful for testing or when user explicitly signs out
 */
export function clearSessionId(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
  }
}

/**
 * Get client context for conversation creation
 * Captures browser/page context for analytics and prompt injection
 */
export function getClientContext(): {
  pageUrl: string;
  referrer: string;
  userAgent: string;
  locale: string;
  timezone: string;
} {
  if (typeof window === 'undefined') {
    return {
      pageUrl: '',
      referrer: '',
      userAgent: '',
      locale: 'en-US',
      timezone: 'UTC',
    };
  }

  return {
    pageUrl: window.location.href,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    locale: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
