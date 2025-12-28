import { useEffect, useRef } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Message } from './Message';
import type { ChatMessage } from '@/hooks/useChat';

interface MessageListProps {
  messages: ChatMessage[];
  onSuggestionClick?: (suggestion: string) => void;
}

export function MessageList({ messages, onSuggestionClick }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Find the index of the last assistant message (for showing suggestions only on latest)
  const lastAssistantIndex = messages.map((m, i) => m.role === 'assistant' ? i : -1)
    .filter(i => i !== -1)
    .pop() ?? -1;

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">Start a conversation</p>
          <p className="text-sm mt-2">Send a message to begin chatting with the assistant</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 h-full" ref={scrollRef}>
      <div className="flex flex-col">
        {messages.map((message, index) => (
          <Message 
            key={message.id} 
            message={message} 
            onSuggestionClick={onSuggestionClick}
            isLatestMessage={index === lastAssistantIndex}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}



