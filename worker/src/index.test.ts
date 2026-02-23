import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAll } from './storage';

const runAgentMock = vi.hoisted(() => vi.fn());
const getAgentConfigMock = vi.hoisted(() => vi.fn());

vi.mock('./agents/index', () => ({
  runAgentTanStackSSE: runAgentMock,
}));

vi.mock('./tenants/config', () => ({
  getAgentConfig: getAgentConfigMock,
}));

vi.mock(
  'cloudflare:workers',
  () => ({
    DurableObject: class {},
  }),
  { virtual: true }
);

describe('Chat API routes', () => {
  let app: typeof import('./index').default;
  const baseEnv = {
    OPENAI_API_KEY: 'test-api-key',
    AUTH_MODE: 'permissive',
  } as any;

  beforeAll(async () => {
    app = (await import('./index')).default;
  });

  beforeEach(() => {
    clearAll();
    runAgentMock.mockReset();
    runAgentMock.mockResolvedValue(new Response('ok', { status: 200 }));
    getAgentConfigMock.mockReset();
    getAgentConfigMock.mockResolvedValue({
      agentId: 'default',
      orgId: 'org-1',
      name: 'Test Agent',
      model: 'gpt-4.1-mini',
      allowedDomains: ['*'],
      tenantId: 'tenant-1',
    });
  });

  it('rejects chat creation without sessionId', async () => {
    const req = new Request('http://localhost/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const res = await app.fetch(req, baseEnv);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Invalid request');
  });

  it('creates a chat in memory for the requested agent', async () => {
    const req = new Request('http://localhost/api/chats?agent=tenant-1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-123', title: 'Support Chat' }),
    });

    const res = await app.fetch(req, baseEnv);
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; agentId: string; title?: string };
    expect(body.id).toBeTruthy();
    expect(body.agentId).toBe('tenant-1');
    expect(body.title).toBe('Support Chat');
  });

  it('lists chats filtered by agent', async () => {
    const create = (agentId: string, title: string) =>
      app.fetch(
        new Request(`http://localhost/api/chats?agent=${agentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: 'session-abc', title }),
        }),
        baseEnv
      );

    await create('tenant-a', 'Chat A');
    await create('tenant-b', 'Chat B');

    const listRes = await app.fetch(
      new Request('http://localhost/api/chats?agent=tenant-a'),
      baseEnv
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json() as { chats: Array<{ agentId: string }> };
    expect(listBody.chats).toHaveLength(1);
    expect(listBody.chats[0]?.agentId).toBe('tenant-a');
  });

  it('streams messages through the agent runner', async () => {
    const createRes = await app.fetch(
      new Request('http://localhost/api/chats?agent=default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'session-xyz', title: 'Chat' }),
      }),
      baseEnv
    );
    const created = await createRes.json() as { id: string };

    const messageRes = await app.fetch(
      new Request(`http://localhost/api/chats/${created.id}/messages?agent=default`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Hello there' }),
      }),
      baseEnv
    );

    expect(messageRes.status).toBe(200);
    expect(runAgentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-api-key',
        agentId: 'default',
        chatId: created.id,
      })
    );
  });

  it('rejects requests without API key when auth is enforced', async () => {
    const env = {
      OPENAI_API_KEY: 'test-api-key',
      AUTH_MODE: 'enforce',
      CONVEX_URL: 'https://test.convex.cloud',
    } as any;

    const req = new Request('http://localhost/api/chats?agent=tenant-1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'session-123', title: 'Support Chat' }),
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Missing API key');
  });

  it('allows requests with valid API key when auth is enforced', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes('/api/keys/validate')) {
        return new Response(
          JSON.stringify({
            id: 'key_1',
            tenantId: 'tenant-1',
            keyPrefix: 'sk_',
            name: 'Test Key',
            scopes: ['widget:chat'],
          }),
          { status: 200 }
        );
      }
      if (url.includes('/api/keys/touch')) {
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      }
      if (url.includes('/api/mutation')) {
        return new Response(
          JSON.stringify({ status: 'success', value: 'convex-chat-id' }),
          { status: 200 }
        );
      }
      return new Response('not found', { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    getAgentConfigMock.mockResolvedValueOnce({
      agentId: 'tenant-1',
      orgId: 'org-1',
      name: 'Tenant Agent',
      model: 'gpt-4.1-mini',
      allowedDomains: ['*'],
      tenantId: 'tenant-1',
    });

    const env = {
      OPENAI_API_KEY: 'test-api-key',
      AUTH_MODE: 'enforce',
      CONVEX_URL: 'https://test.convex.cloud',
      CONVEX_HTTP_SECRET: 'test-secret',
    } as any;

    const req = new Request('http://localhost/api/chats?agent=tenant-1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk_test_key',
      },
      body: JSON.stringify({ sessionId: 'session-123', title: 'Support Chat' }),
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(201);

    const validateCall = fetchMock.mock.calls.find(([input]) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      return url.includes('/api/keys/validate');
    });

    expect(validateCall).toBeTruthy();
    const validateInit = validateCall?.[1] as RequestInit | undefined;
    expect((validateInit?.headers as Record<string, string>)?.Authorization).toBe('Bearer test-secret');
  });
});
