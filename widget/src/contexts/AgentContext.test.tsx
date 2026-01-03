/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Agent URL Parameter Extraction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  function getAgentFromUrl(search: string): string | null {
    try {
      const urlParams = new URLSearchParams(search);
      return urlParams.get('agent');
    } catch {
      return null;
    }
  }

  it('extracts agent from URL param', () => {
    expect(getAgentFromUrl('?agent=test-agent-123')).toBe('test-agent-123');
  });

  it('returns null when no agent param', () => {
    expect(getAgentFromUrl('')).toBe(null);
    expect(getAgentFromUrl('?foo=bar')).toBe(null);
  });

  it('handles URL-encoded agent IDs', () => {
    expect(getAgentFromUrl('?agent=my%20agent')).toBe('my agent');
    expect(getAgentFromUrl('?agent=tenant%2Dxyz')).toBe('tenant-xyz');
  });

  it('handles multiple params', () => {
    expect(getAgentFromUrl('?foo=bar&agent=my-agent&baz=qux')).toBe('my-agent');
  });
});

describe('Iframe Detection', () => {
  function isInIframe(): boolean {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  it('returns false when not in iframe', () => {
    expect(isInIframe()).toBe(false);
  });
});

describe('postMessage Protocol', () => {
  const NAMESPACE = 'mychat-widget';

  interface WidgetMessage {
    source: string;
    version: number;
    type: 'INIT' | 'OPEN' | 'CLOSE' | 'WIDGET_READY' | 'REQUEST_CLOSE';
    payload?: unknown;
  }

  function createMessage(type: WidgetMessage['type'], payload?: unknown): WidgetMessage {
    return {
      source: NAMESPACE,
      version: 1,
      type,
      payload,
    };
  }

  function isValidMessage(data: unknown): data is WidgetMessage {
    if (!data || typeof data !== 'object') return false;
    const msg = data as Record<string, unknown>;
    return msg.source === NAMESPACE && typeof msg.version === 'number' && typeof msg.type === 'string';
  }

  it('creates valid WIDGET_READY message', () => {
    const msg = createMessage('WIDGET_READY');
    expect(isValidMessage(msg)).toBe(true);
    expect(msg.type).toBe('WIDGET_READY');
    expect(msg.source).toBe(NAMESPACE);
    expect(msg.version).toBe(1);
  });

  it('creates valid INIT message with payload', () => {
    const msg = createMessage('INIT', { agentId: 'test-123', color: '#4F46E5' });
    expect(isValidMessage(msg)).toBe(true);
    expect(msg.type).toBe('INIT');
    expect(msg.payload).toEqual({ agentId: 'test-123', color: '#4F46E5' });
  });

  it('creates valid REQUEST_CLOSE message', () => {
    const msg = createMessage('REQUEST_CLOSE');
    expect(isValidMessage(msg)).toBe(true);
    expect(msg.type).toBe('REQUEST_CLOSE');
  });

  it('validates message structure', () => {
    expect(isValidMessage(null)).toBe(false);
    expect(isValidMessage({})).toBe(false);
    expect(isValidMessage({ source: 'wrong' })).toBe(false);
    expect(isValidMessage({ source: NAMESPACE, version: 1, type: 'INIT' })).toBe(true);
  });
});
