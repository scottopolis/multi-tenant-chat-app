import { useEffect, useMemo, useState } from 'react';
import { UIResourceRenderer, isUIResource } from '@mcp-ui/client';
import { API_URL } from '@/lib/config';
import { useAgent } from '@/contexts/AgentContext';

interface McpToolUiProps {
  toolResult: unknown;
}

export type UiResourceWrapper = {
  type: 'resource';
  resource: {
    uri: string;
    mimeType: string;
    text?: string;
    blob?: string;
    _meta?: Record<string, unknown>;
  };
};

export function findUiResource(value: unknown): UiResourceWrapper | null {
  if (!value) return null;

  if (isUIResource(value)) {
    return value as UiResourceWrapper;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const content = obj.content;
    if (Array.isArray(content)) {
      const resource = content.find((item) => isUIResource(item));
      if (resource) return resource as UiResourceWrapper;
    }
  }

  return null;
}

function findResourceUri(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, any>;
  if (typeof obj.resourceUri === 'string') return obj.resourceUri;
  if (obj._meta?.ui?.resourceUri) return obj._meta.ui.resourceUri as string;
  return null;
}

export function McpToolUi({ toolResult }: McpToolUiProps) {
  const { agentId, apiKey } = useAgent();
  const embeddedResource = useMemo(() => findUiResource(toolResult), [toolResult]);
  const resourceUri = useMemo(() => (embeddedResource ? null : findResourceUri(toolResult)), [embeddedResource, toolResult]);
  const [remoteResource, setRemoteResource] = useState<UiResourceWrapper | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    if (!resourceUri) {
      setRemoteResource(null);
      setRemoteError(null);
      return;
    }

    (async () => {
      try {
        const response = await fetch(`${API_URL}/api/mcp/resources/read?agent=${encodeURIComponent(agentId)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({ uri: resourceUri }),
        });

        if (!response.ok) {
          throw new Error(`Failed to load MCP resource (${response.status})`);
        }

        const data = await response.json();
        const resource = Array.isArray(data.contents) ? data.contents.find((item: unknown) => isUIResource(item)) : null;
        if (resource && isActive) {
          setRemoteResource(resource as UiResourceWrapper);
          setRemoteError(null);
        }
      } catch (error) {
        if (isActive) {
          setRemoteError(error instanceof Error ? error.message : 'Failed to load MCP resource');
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [agentId, apiKey, resourceUri]);

  const resource = embeddedResource ?? remoteResource;
  if (!resource) {
    return remoteError ? (
      <div className="text-xs text-gray-500">MCP UI unavailable.</div>
    ) : null;
  }

  return (
    <UIResourceRenderer
      resource={resource.resource}
      onUIAction={(action) => {
        console.log('MCP UI action:', action);
      }}
    />
  );
}
