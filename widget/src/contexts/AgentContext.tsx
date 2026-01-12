import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

/**
 * Agent Context - Manages the current agent/org ID
 * 
 * Priority for agent ID:
 * 1. URL param ?agent=xxx (for iframe embedding)
 * 2. postMessage from parent (for embed.js integration)
 * 3. localStorage (for persistence across sessions)
 * 4. VITE_AGENT_ID env var
 * 5. 'default' fallback
 */

interface AgentContextType {
  agentId: string;
  setAgentId: (id: string) => void;
  isEmbedded: boolean;
  apiKey: string | null;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

interface EmbedContextType {
  requestClose: () => void;
}

const EmbedContext = createContext<EmbedContextType | undefined>(undefined);

const STORAGE_KEY = 'chat-assistant-agent-id';
const DEFAULT_AGENT_ID = import.meta.env.VITE_AGENT_ID || 'default';
const NAMESPACE = 'mychat-widget';

/**
 * Get agent ID from URL params
 */
function getAgentFromUrl(): string | null {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('agent');
  } catch {
    return null;
  }
}

/**
 * Check if we're in an iframe
 */
function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // If we can't access window.top, we're in an iframe
  }
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const isEmbedded = isInIframe();
  
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [agentId, setAgentIdState] = useState<string>(() => {
    // Priority: URL param > localStorage > env var > default
    const urlAgent = getAgentFromUrl();
    if (urlAgent) return urlAgent;
    
    // Only use localStorage if not embedded
    if (!isEmbedded) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
    }
    
    return DEFAULT_AGENT_ID;
  });

  const [parentOrigin, setParentOrigin] = useState<string | null>(null);

  // Persist to localStorage whenever it changes (only if not embedded)
  useEffect(() => {
    if (!isEmbedded) {
      localStorage.setItem(STORAGE_KEY, agentId);
    }
  }, [agentId, isEmbedded]);

  // Listen for postMessage from parent window (embed.js)
  useEffect(() => {
    if (!isEmbedded) return;

    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || data.source !== NAMESPACE) return;

      // Store parent origin on first valid message
      if (data.type === 'INIT' && !parentOrigin) {
        setParentOrigin(event.origin);
      }

      // Only accept messages from known parent origin after INIT
      if (parentOrigin && event.origin !== parentOrigin) return;

      switch (data.type) {
        case 'INIT':
          if (data.payload?.agentId) {
            setAgentIdState(data.payload.agentId);
          }
          if (data.payload?.apiKey) {
            setApiKey(data.payload.apiKey);
          }
          break;
      }
    }

    window.addEventListener('message', handleMessage);
    
    // Notify parent that widget is ready
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(
        { source: NAMESPACE, version: 1, type: 'WIDGET_READY' },
        '*' // Use * initially, parent should verify source
      );
    }

    return () => window.removeEventListener('message', handleMessage);
  }, [isEmbedded, parentOrigin]);

  const setAgentId = (id: string) => {
    setAgentIdState(id);
  };

  // Function to request parent to close the widget
  const requestClose = () => {
    if (isEmbedded && window.parent && window.parent !== window) {
      window.parent.postMessage(
        { source: NAMESPACE, version: 1, type: 'REQUEST_CLOSE' },
        parentOrigin || '*'
      );
    }
  };

  return (
    <AgentContext.Provider value={{ agentId, setAgentId, isEmbedded, apiKey }}>
      <EmbedContext.Provider value={{ requestClose }}>
        {children}
      </EmbedContext.Provider>
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (context === undefined) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
}

export function useEmbed() {
  const context = useContext(EmbedContext);
  if (context === undefined) {
    throw new Error('useEmbed must be used within an AgentProvider');
  }
  return context;
}

