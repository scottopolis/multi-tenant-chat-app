import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/hooks/useChat';
import { Loader2 } from 'lucide-react';
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
        'flex px-6 py-3',
        isUser && 'justify-end'
      )}
    >
      <div className={cn('flex flex-col max-w-[85%]', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-xl px-4 py-3',
            isUser
              ? 'bg-gray-900 text-white'
              : 'bg-white border border-gray-200 text-gray-900'
          )}
        >
          {/* Main content */}
          <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
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
                className="text-xs h-8 rounded-full"
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
