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
  toolName?: string;
  toolCallId?: string;
  toolInput?: unknown;
  toolResult?: unknown;
  toolEventType?: 'tool_call' | 'tool_result';
}

export interface UseChatOptions {
  chatId: string;
  agentId: string;
  apiKey?: string | null;
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
export function useChat({ chatId, agentId, apiKey, onError, onChatNotFound }: UseChatOptions) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial chat data
  const { data: chatData, isLoading, error: queryError } = useQuery({
    queryKey: ['chat', chatId, agentId],
    queryFn: () => getChat(chatId, agentId, apiKey ?? undefined),
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
        const toolEvents: Array<{
          type: 'tool_call' | 'tool_result';
          toolName?: string;
          toolCallId?: string;
          toolInput?: unknown;
          toolResult?: unknown;
        }> = [];

        for await (const { event, data } of streamMessage(chatId, {
          content: content.trim(),
          model,
        }, agentId, apiKey ?? undefined)) {
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
          } else if (event === 'tool_call') {
            const parsed = JSON.parse(data);
            let toolInput: unknown = parsed.toolCall?.function?.arguments;
            if (typeof toolInput === 'string') {
              try {
                toolInput = JSON.parse(toolInput);
              } catch {
                // Keep as string if not valid JSON
              }
            }
            toolEvents.push({
              type: 'tool_call',
              toolName: parsed.toolCall?.function?.name,
              toolCallId: parsed.toolCall?.id,
              toolInput,
            });
          } else if (event === 'tool_result') {
            const parsed = JSON.parse(data);
            let toolResult: unknown = parsed.result ?? parsed.content ?? parsed;
            if (typeof toolResult === 'string') {
              try {
                toolResult = JSON.parse(toolResult);
              } catch {
                // Keep as string if not valid JSON
              }
            }
            toolEvents.push({
              type: 'tool_result',
              toolName: parsed.toolName,
              toolCallId: parsed.toolCallId,
              toolResult,
            });
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
            
            if (toolEvents.length > 0) {
              setMessages((prev) => {
                const updated = [...prev];
                const insertIndex = updated.findIndex((msg) => msg.id === assistantMessageId);
                if (insertIndex === -1) return prev;
                const toolMessages = toolEvents.map((evt) => ({
                  id: crypto.randomUUID(),
                  chatId,
                  role: 'system' as const,
                  content: '',
                  toolName: evt.toolName,
                  toolCallId: evt.toolCallId,
                  toolInput: evt.toolInput,
                  toolResult: evt.toolResult,
                  toolEventType: evt.type,
                }));
                updated.splice(insertIndex, 0, ...toolMessages);
                return updated;
              });
            }

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
    [chatId, agentId, apiKey, isStreaming, queryClient, onError]
  );

  return {
    messages,
    sendMessage,
    isLoading,
    isStreaming,
    error,
  };
}
