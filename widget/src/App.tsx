import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { Chat } from './components/Chat';
import { ChatList } from './components/ChatList';
import { Button } from './components/ui/button';
import { createChat, listChats } from './lib/api';
import { MessageSquarePlus, Loader2, Menu } from 'lucide-react';
import { AgentProvider, useAgent } from './contexts/AgentContext';

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
  const { agentId, apiKey } = useAgent();
  const queryClient = useQueryClient();
  const [chatId, setChatId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);

  const { data: chats, isLoading: isChatsLoading } = useQuery({
    queryKey: ['chats', agentId],
    queryFn: () => listChats(agentId, apiKey ?? undefined),
  });

  // Select the most recent existing chat for this session
  useEffect(() => {
    if (!chatId && chats && chats.length > 0) {
      setChatId(chats[0].id);
    }
  }, [chatId, chats]);

  // Reset chat when agent changes
  useEffect(() => {
    setChatId(null);
  }, [agentId]);

  const handleCreateChat = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      const newChat = await createChat({ title: 'New Chat' }, agentId, apiKey ?? undefined);
      setChatId(newChat.id);
      // Refresh chat list
      queryClient.invalidateQueries({ queryKey: ['chats', agentId] });
    } catch (error) {
      console.error('Failed to create chat:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectChat = (selectedChatId: string) => {
    setChatId(selectedChatId);
    setShowSidebar(false);
  };

  if (!chatId) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          {isChatsLoading || isCreating ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">Loading conversations...</p>
            </>
          ) : (
            <>
              <MessageSquarePlus className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">Chat Assistant</h1>
              <p className="text-gray-500 mb-6">Start a conversation</p>
              <Button onClick={handleCreateChat}>New Chat</Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-white">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-900">Chat Assistant</h1>
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
        <div className="flex-1 overflow-hidden bg-gray-50">
          <Chat
            chatId={chatId}
            agentId={agentId}
            onChatNotFound={() => {
              setChatId(null);
            }}
          />
        </div>
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
