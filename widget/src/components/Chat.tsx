import { useChat } from '@/hooks/useChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { Loader2, AlertCircle } from 'lucide-react';

interface ChatProps {
  chatId: string;
  agentId: string;
  onChatNotFound?: () => void;
}

export function Chat({ chatId, agentId, onChatNotFound }: ChatProps) {
  const { messages, sendMessage, isLoading, isStreaming, error } = useChat({
    chatId,
    agentId,
    onError: (err) => {
      console.error('Chat error:', err);
    },
    onChatNotFound,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-700 border-b border-red-100">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      
      <MessageList 
        messages={messages} 
        onSuggestionClick={(suggestion) => sendMessage(suggestion)}
      />
      
      <MessageInput
        onSend={(content) => sendMessage(content)}
        disabled={isStreaming}
        placeholder={
          isStreaming ? 'Waiting for response...' : 'Type a message...'
        }
      />
    </div>
  );
}
