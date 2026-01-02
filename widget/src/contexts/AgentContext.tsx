import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

/**
 * Agent Context - Manages the current agent/org ID
 * 
 * This context provides a way to switch between different tenants/orgs
 * which maps to the backend's orgId parameter.
 */

interface AgentContextType {
  agentId: string;
  setAgentId: (id: string) => void;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

const STORAGE_KEY = 'chat-assistant-agent-id';
const DEFAULT_AGENT_ID = import.meta.env.VITE_AGENT_ID || 'new-agent';

export function AgentProvider({ children }: { children: ReactNode }) {
  const [agentId, setAgentIdState] = useState<string>(() => {
    // Try to load from localStorage first
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored || DEFAULT_AGENT_ID;
  });

  // Persist to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, agentId);
  }, [agentId]);

  const setAgentId = (id: string) => {
    setAgentIdState(id);
    // Invalidate all queries when agent changes
    // This will be handled by the App component
  };

  return (
    <AgentContext.Provider value={{ agentId, setAgentId }}>
      {children}
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




