/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';

/**
 * Unit tests for embed.js configuration parsing logic
 * These test the core logic used by embed.js without needing to load the full script
 */

describe('Embed Config Parsing', () => {
  function parseDataAttributes(element: HTMLElement) {
    return {
      agentId: element.getAttribute('data-agent-id'),
      color: element.getAttribute('data-color') || '#4F46E5',
      position: element.getAttribute('data-position') || 'bottom-right',
      icon: element.getAttribute('data-icon') || 'chat',
    };
  }

  it('parses required agent ID', () => {
    const script = document.createElement('script');
    script.setAttribute('data-agent-id', 'tenant-abc');
    
    const config = parseDataAttributes(script);
    expect(config.agentId).toBe('tenant-abc');
  });

  it('uses default values when optional attributes not provided', () => {
    const script = document.createElement('script');
    script.setAttribute('data-agent-id', 'test');
    
    const config = parseDataAttributes(script);
    expect(config.color).toBe('#4F46E5');
    expect(config.position).toBe('bottom-right');
    expect(config.icon).toBe('chat');
  });

  it('parses all custom attributes', () => {
    const script = document.createElement('script');
    script.setAttribute('data-agent-id', 'custom-agent');
    script.setAttribute('data-color', '#FF5733');
    script.setAttribute('data-position', 'bottom-left');
    script.setAttribute('data-icon', 'help');
    
    const config = parseDataAttributes(script);
    expect(config.agentId).toBe('custom-agent');
    expect(config.color).toBe('#FF5733');
    expect(config.position).toBe('bottom-left');
    expect(config.icon).toBe('help');
  });

  it('returns null for missing agent ID', () => {
    const script = document.createElement('script');
    
    const config = parseDataAttributes(script);
    expect(config.agentId).toBeNull();
  });
});

describe('Auto-Open URL Detection', () => {
  function shouldAutoOpen(search: string): boolean {
    try {
      const urlParams = new URLSearchParams(search);
      return urlParams.get('chat') === 'open';
    } catch {
      return false;
    }
  }

  it('returns true when ?chat=open is present', () => {
    expect(shouldAutoOpen('?chat=open')).toBe(true);
  });

  it('returns false when ?chat has different value', () => {
    expect(shouldAutoOpen('?chat=closed')).toBe(false);
    expect(shouldAutoOpen('?chat=true')).toBe(false);
  });

  it('returns false when no chat param', () => {
    expect(shouldAutoOpen('')).toBe(false);
    expect(shouldAutoOpen('?foo=bar')).toBe(false);
  });

  it('works with multiple params', () => {
    expect(shouldAutoOpen('?page=1&chat=open&other=value')).toBe(true);
  });
});

describe('Mobile Detection', () => {
  function isMobile(width: number): boolean {
    return width <= 768;
  }

  it('returns true for mobile viewport', () => {
    expect(isMobile(320)).toBe(true);
    expect(isMobile(768)).toBe(true);
  });

  it('returns false for desktop viewport', () => {
    expect(isMobile(769)).toBe(false);
    expect(isMobile(1024)).toBe(false);
    expect(isMobile(1920)).toBe(false);
  });
});

describe('Iframe URL Construction', () => {
  const WIDGET_ORIGIN = 'https://chat-widget.pages.dev';

  function buildIframeUrl(agentId: string): string {
    return `${WIDGET_ORIGIN}/?agent=${encodeURIComponent(agentId)}`;
  }

  it('builds correct iframe URL with agent ID', () => {
    expect(buildIframeUrl('tenant-abc')).toBe('https://chat-widget.pages.dev/?agent=tenant-abc');
  });

  it('encodes special characters in agent ID', () => {
    expect(buildIframeUrl('my agent')).toBe('https://chat-widget.pages.dev/?agent=my%20agent');
    expect(buildIframeUrl('tenant/123')).toBe('https://chat-widget.pages.dev/?agent=tenant%2F123');
  });
});

describe('Position Style Calculation', () => {
  function getPositionStyles(position: string): string {
    return position === 'bottom-left' ? 'left: 24px;' : 'right: 24px;';
  }

  it('returns left position for bottom-left', () => {
    expect(getPositionStyles('bottom-left')).toBe('left: 24px;');
  });

  it('returns right position for bottom-right', () => {
    expect(getPositionStyles('bottom-right')).toBe('right: 24px;');
  });

  it('defaults to right for unknown position', () => {
    expect(getPositionStyles('unknown')).toBe('right: 24px;');
  });
});
