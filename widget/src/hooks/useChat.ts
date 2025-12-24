import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getChat, sendMessage as apiSendMessage, streamMessage } from '@/lib/api';
import type { Message } from '@/lib/api';

/**
 * Extended message interface with streaming state
 */
export interface ChatMessage extends Omit<Message, 'createdAt'> {
  isStreaming?: boolean;
  createdAt?: string;
}

export interface UseChatOptions {
  chatId: string;
  onError?: (error: Error) => void;
}

/**
 * Custom hook for managing chat state and streaming
 * 
 * Provides:
 * - messages: Array of messages with streaming state
 * - sendMessage: Function to send a new message
 * - isLoading: Whether initial data is loading
 * - error: Any error that occurred
 */
export function useChat({ chatId, onError }: UseChatOptions) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial chat data
  const { data: chatData, isLoading } = useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => getChat(chatId),
    enabled: !!chatId,
  });

  // Update messages when chat data loads
  useEffect(() => {
    if (chatData?.messages) {
      setMessages(chatData.messages);
    }
  }, [chatData]);

  /**
   * Send a message and handle streaming response
   */
  const sendMessage = useCallback(
    async (content: string, model?: string) => {
      if (!content.trim() || isStreaming) return;

      setIsStreaming(true);
      setError(null);

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        chatId,
        role: 'user',
        content: content.trim(),
      };

      // Add placeholder assistant message
      const assistantMessageId = crypto.randomUUID();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        chatId,
        role: 'assistant',
        content: '',
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);

      try {
        // Stream the response
        let fullContent = '';

        for await (const { event, data } of streamMessage(chatId, {
          content: content.trim(),
          model,
        })) {
          if (event === 'text') {
            fullContent += data;
            
            // Update the assistant message with accumulated content
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: fullContent }
                  : msg
              )
            );
          } else if (event === 'done') {
            // Mark streaming as complete
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, isStreaming: false }
                  : msg
              )
            );
            
            // Invalidate chat query to refresh from server
            queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
          } else if (event === 'error') {
            const errorData = JSON.parse(data);
            throw new Error(errorData.error || 'Streaming error');
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
        setError(errorMessage);
        
        // Remove the placeholder assistant message on error
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantMessageId)
        );

        if (onError) {
          onError(err instanceof Error ? err : new Error(errorMessage));
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [chatId, isStreaming, queryClient, onError]
  );

  return {
    messages,
    sendMessage,
    isLoading,
    isStreaming,
    error,
  };
}

