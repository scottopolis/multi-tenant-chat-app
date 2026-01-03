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
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-destructive/10 text-destructive border-b border-destructive/20">
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

