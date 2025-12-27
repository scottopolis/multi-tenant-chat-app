import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Chat } from './components/Chat';
import { Button } from './components/ui/button';
import { createChat } from './lib/api';
import { MessageSquarePlus, Loader2 } from 'lucide-react';
import { AgentProvider, useAgent } from './contexts/AgentContext';
import { AgentSelector } from './components/AgentSelector';

/**
 * Main App Component
 * 
 * TODO: JWT handling via postMessage (for iframe embedding)
 * - Listen for postMessage with auth token from parent window
 * - Store token in context/state for API requests
 * - Handle token refresh and expiration
 * 
 * TODO: Chat list sidebar
 * - Show list of recent chats
 * - Allow switching between chats
 * - Add search/filter functionality
 * - Display chat titles and last message preview
 */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppContent() {
  const { agentId } = useAgent();
  const [chatId, setChatId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Auto-create a chat on mount if none exists
  useEffect(() => {
    if (!chatId) {
      handleCreateChat();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Reset chat when agent changes
  useEffect(() => {
    setChatId(null);
  }, [agentId]);

  const handleCreateChat = async () => {
    setIsCreating(true);
    try {
      const newChat = await createChat({ title: 'New Chat' }, agentId);
      setChatId(newChat.id);
    } catch (error) {
      console.error('Failed to create chat:', error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!chatId) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          {isCreating ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Creating chat...</p>
            </>
          ) : (
            <>
              <MessageSquarePlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h1 className="text-2xl font-semibold mb-2">Chat Assistant</h1>
              <p className="text-muted-foreground mb-4">Start a conversation</p>
              <Button onClick={handleCreateChat}>New Chat</Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Chat Assistant</h1>
          <AgentSelector />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCreateChat}
          disabled={isCreating}
        >
          <MessageSquarePlus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      {/* Chat */}
      <div className="flex-1 overflow-hidden">
        <Chat chatId={chatId} agentId={agentId} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AgentProvider>
        <AppContent />
      </AgentProvider>
    </QueryClientProvider>
  );
}

