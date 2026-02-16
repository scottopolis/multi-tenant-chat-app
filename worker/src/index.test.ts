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
});
