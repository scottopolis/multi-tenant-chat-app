import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listChats, deleteChat, type ChatListItem } from '@/lib/api';
import { Loader2, MessageSquare, Trash2, X } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface ChatListProps {
  agentId: string;
  currentChatId?: string | null;
  onSelectChat: (chatId: string) => void;
  onClose?: () => void;
  apiKey?: string | null;
}

export function ChatList({
  agentId,
  currentChatId,
  onSelectChat,
  onClose,
  apiKey,
}: ChatListProps) {
  const queryClient = useQueryClient();

  const { data: chats, isLoading, error } = useQuery({
    queryKey: ['chats', agentId],
    queryFn: () => listChats(agentId, apiKey ?? undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: (chatId: string) => deleteChat(chatId, agentId, apiKey ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats', agentId] });
    },
  });

  const handleDelete = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (confirm('Delete this conversation?')) {
      deleteMutation.mutate(chatId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600">
        Failed to load conversations
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">Conversations</h2>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto">
        {!chats || chats.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 text-center">
            No conversations yet
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {chats.map((chat: ChatListItem) => (
              <li
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={cn(
                  'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors',
                  chat.id === currentChatId && 'bg-blue-50 hover:bg-blue-50'
                )}
              >
                <MessageSquare className="h-5 w-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {chat.title}
                  </p>
                  {chat.preview && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {chat.preview}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(chat.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                  onClick={(e) => handleDelete(e, chat.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
