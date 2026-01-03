import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getChat, streamMessage } from '@/lib/api';
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
  agentId: string;
  onError?: (error: Error) => void;
  onChatNotFound?: () => void;
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
export function useChat({ chatId, agentId, onError, onChatNotFound }: UseChatOptions) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial chat data
  const { data: chatData, isLoading, error: queryError } = useQuery({
    queryKey: ['chat', chatId, agentId],
    queryFn: () => getChat(chatId, agentId),
    enabled: !!chatId,
    retry: (failureCount, error) => {
      // Don't retry 404s - chat doesn't exist
      if (error instanceof Error && error.message.includes('404')) {
        return false;
      }
      return failureCount < 2;
    },
  });

  // Handle chat not found - trigger recreation
  useEffect(() => {
    if (queryError instanceof Error && queryError.message.includes('404')) {
      onChatNotFound?.();
    }
  }, [queryError, onChatNotFound]);

  // Update messages when chat data loads
  useEffect(() => {
    if (chatData?.messages) {
      setMessages(chatData.messages);
    }
  }, [chatData]);

  /**
   * Send a message and handle streaming response
   * 
   * Streaming behavior:
   * - Detects structured JSON responses (starts with { or [)
   * - For structured: Buffers entire response, displays after parsing (avoids showing raw JSON)
   * - For plain text: Streams content normally, showing text as it arrives
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
        let isStructuredResponse = false;
        let firstChunkReceived = false;

        for await (const { event, data } of streamMessage(chatId, {
          content: content.trim(),
          model,
        }, agentId)) {
          if (event === 'text') {
            fullContent += data;
            
            // On first chunk, detect if this is structured JSON output
            // Structured responses (like {"response": "..."}) should be buffered and parsed
            if (!firstChunkReceived) {
              firstChunkReceived = true;
              const trimmed = fullContent.trim();
              isStructuredResponse = trimmed.startsWith('{') || trimmed.startsWith('[');
            }
            
            // Update UI based on response type:
            // - Plain text: Stream content as it arrives (natural typing effect)
            // - Structured JSON: Buffer completely (avoid showing raw JSON to user)
            if (!isStructuredResponse) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: fullContent }
                    : msg
                )
              );
            }
          } else if (event === 'done') {
            // Streaming complete - set final content and mark as done
            // For structured responses, this is when content first appears (after parsing)
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: fullContent, isStreaming: false }
                  : msg
              )
            );
            
            // Invalidate chat query to refresh from server
            queryClient.invalidateQueries({ queryKey: ['chat', chatId, agentId] });
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
    [chatId, agentId, isStreaming, queryClient, onError]
  );

  return {
    messages,
    sendMessage,
    isLoading,
    isStreaming,
    error,
  };
}

