import type { ChatMessage } from '@/hooks/useChat';
import { McpToolUi, findUiResource } from './McpToolUi';

interface ToolMessageProps {
  message: ChatMessage;
}

export function ToolMessage({ message }: ToolMessageProps) {
  if (message.toolEventType !== 'tool_result') {
    return null;
  }

  const uiResource = findUiResource(message.toolResult);
  const resourceUri = message.toolResult && typeof message.toolResult === 'object'
    ? (message.toolResult as any)?._meta?.ui?.resourceUri || (message.toolResult as any)?.resourceUri
    : null;
  if (!uiResource && !resourceUri) {
    return null;
  }

  return (
    <div className="flex px-6 py-3">
      <div className="max-w-[85%] w-full">
        <div className="rounded-xl px-4 py-3 bg-white border border-gray-200 text-gray-900">
          <McpToolUi toolResult={message.toolResult} />
        </div>
      </div>
    </div>
  );
}
