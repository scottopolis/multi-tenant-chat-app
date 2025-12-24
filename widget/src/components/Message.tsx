import { Avatar, AvatarFallback } from './ui/avatar';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/hooks/useChat';
import { User, Bot, Loader2 } from 'lucide-react';

/**
 * Message component
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

  return (
    <div
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
          <div className="text-sm whitespace-pre-wrap break-words">
            {message.content || (message.isStreaming && '...')}
          </div>
          
          {message.isStreaming && (
            <div className="flex items-center gap-2 mt-2 text-xs opacity-70">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

