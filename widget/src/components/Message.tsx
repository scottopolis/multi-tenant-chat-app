import { useState } from 'react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/hooks/useChat';
import { User, Bot, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { parseMessageContent } from '@/lib/structured-output';

/**
 * Message component
 * 
 * Features:
 * - Detects and parses structured JSON responses
 * - Extracts 'response' field for display if available
 * - Shows metadata (like reasoning) in expandable section
 * 
 * TODO: Add markdown support
 * - Use react-markdown or similar to render formatted content
 * - Support code blocks with syntax highlighting
 * - Handle links, lists, and other markdown features
 */

interface MessageProps {
  message: ChatMessage;
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const [showMetadata, setShowMetadata] = useState(false);

  // Parse content to detect structured responses
  // Only parse if not streaming (to avoid JSON parsing errors on incomplete data)
  // For streaming messages, content will be empty for structured responses (buffered in useChat)
  const parsed = !message.isStreaming && message.content
    ? parseMessageContent(message.content)
    : { isStructured: false, displayText: message.content || '' };

  const hasMetadata = parsed.metadata && Object.keys(parsed.metadata).length > 0;

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

          {/* Metadata section (for structured responses) */}
          {!message.isStreaming && hasMetadata && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <button
                onClick={() => setShowMetadata(!showMetadata)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showMetadata ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                <span>
                  {showMetadata ? 'Hide' : 'Show'} details
                </span>
              </button>
              
              {showMetadata && (
                <div className="mt-2 space-y-2">
                  {Object.entries(parsed.metadata!).map(([key, value]) => (
                    <div key={key} className="text-xs">
                      <span className="font-medium capitalize">{key}:</span>
                      <div className="mt-1 text-muted-foreground whitespace-pre-wrap">
                        {typeof value === 'object' 
                          ? JSON.stringify(value, null, 2)
                          : String(value)
                        }
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

