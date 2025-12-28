import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/hooks/useChat';
import { User, Bot, Loader2 } from 'lucide-react';
import { parseMessageContent } from '@/lib/structured-output';

/**
 * Message component
 * 
 * Features:
 * - Detects and parses structured JSON responses
 * - Extracts 'response' field for display if available
 * - Shows 'suggestions' as clickable buttons for quick follow-ups
 * 
 * TODO: Add markdown support
 * - Use react-markdown or similar to render formatted content
 * - Support code blocks with syntax highlighting
 * - Handle links, lists, and other markdown features
 */

interface MessageProps {
  message: ChatMessage;
  onSuggestionClick?: (suggestion: string) => void;
  isLatestMessage?: boolean;
}

export function Message({ message, onSuggestionClick, isLatestMessage = false }: MessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  // Parse content to detect structured responses
  // Only parse if not streaming (to avoid JSON parsing errors on incomplete data)
  // For streaming messages, content will be empty for structured responses (buffered in useChat)
  const parsed = !message.isStreaming && message.content
    ? parseMessageContent(message.content)
    : { isStructured: false, displayText: message.content || '' };

  // Only show suggestions on the latest assistant message
  const hasSuggestions = isLatestMessage && parsed.suggestions && parsed.suggestions.length > 0;

  return (
    <div
      data-role={message.role}
      data-streaming={message.isStreaming}
      className={cn(
        'flex gap-3 p-4',
        isUser && 'flex-row-reverse',
        isAssistant && 'bg-muted/50'
      )}
    >
      <Avatar className="h-8 w-8">
        <AvatarFallback
          className={cn(
            isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary'
          )}
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={cn('flex flex-col gap-1 flex-1', isUser && 'items-end')}>
        <div className="text-xs font-medium text-muted-foreground">
          {isUser ? 'You' : 'Assistant'}
        </div>
        
        <div
          className={cn(
            'rounded-lg px-4 py-2 max-w-[80%]',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-background border border-border'
          )}
        >
          {/* Main content */}
          <div className="text-sm whitespace-pre-wrap break-words">
            {message.isStreaming 
              ? (message.content || '...')
              : (parsed.displayText || '...')
            }
          </div>
          
          {/* Streaming indicator */}
          {message.isStreaming && (
            <div className="flex items-center gap-2 mt-2 text-xs opacity-70">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
        </div>

        {/* Suggestion buttons (for structured responses) */}
        {!message.isStreaming && hasSuggestions && onSuggestionClick && (
          <div className="mt-2 flex flex-wrap gap-2">
            {parsed.suggestions!.map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => onSuggestionClick(suggestion)}
                className="text-xs h-8"
              >
                {suggestion}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

