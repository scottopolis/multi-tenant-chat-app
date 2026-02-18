import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import voiceRoutes from './voice';

// Mock convex client
vi.mock('../convex/client', () => ({
  convexQuery: vi.fn(),
  convexMutation: vi.fn(),
}));

describe('Voice Preview Routes', () => {
  let app: Hono;
  let mockDoNamespace: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDoNamespace = {
      idFromName: vi.fn().mockReturnValue('mock-do-id'),
      get: vi.fn().mockReturnValue({
        fetch: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
      }),
    };

    app = new Hono();
    app.use('*', async (c, next) => {
      c.env = {
        DEEPGRAM_API_KEY: 'test-api-key',
        CONVEX_URL: 'https://test.convex.cloud',
        WEB_VOICE_SESSION: mockDoNamespace,
      };
      await next();
    });
    app.route('/voice', voiceRoutes);
  });

  describe('POST /voice/preview/token', () => {
    it('should generate a token with valid payload', async () => {
      const req = new Request('http://localhost/voice/preview/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentDbId: 'agent123',
          tenantId: 'tenant123',
        }),
      });

      const res = await app.fetch(req);
      expect(res.status).toBe(200);

      const body = await res.json() as { token: string };
      expect(body.token).toBeDefined();

      // Decode and verify token
      const decoded = JSON.parse(atob(body.token));
      expect(decoded.agentDbId).toBe('agent123');
      expect(decoded.tenantId).toBe('tenant123');
      expect(decoded.exp).toBeGreaterThan(Date.now());
    });

    it('should return 400 when agentDbId is missing', async () => {
      const req = new Request('http://localhost/voice/preview/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: 'tenant123' }),
      });

      const res = await app.fetch(req);
      expect(res.status).toBe(400);

      const body = await res.json() as { error: string };
      expect(body.error).toBe('Missing agentDbId or tenantId');
    });

    it('should return 400 when tenantId is missing', async () => {
      const req = new Request('http://localhost/voice/preview/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentDbId: 'agent123' }),
      });

      const res = await app.fetch(req);
      expect(res.status).toBe(400);

      const body = await res.json() as { error: string };
      expect(body.error).toBe('Missing agentDbId or tenantId');
    });
  });

  describe('GET /voice/preview', () => {
    const createValidToken = (agentDbId: string, tenantId: string, expOffset = 5 * 60 * 1000) => {
      const payload = {
        agentDbId,
        tenantId,
        exp: Date.now() + expOffset,
      };
      return btoa(JSON.stringify(payload));
    };

    it('should return 400 when agentDbId is missing', async () => {
      const req = new Request('http://localhost/voice/preview?tenantId=t1&token=abc', {
        headers: { Upgrade: 'websocket' },
      });

      const res = await app.fetch(req);
      expect(res.status).toBe(400);
      expect(await res.text()).toBe('Missing agentDbId or tenantId');
    });

    it('should return 400 when tenantId is missing', async () => {
      const req = new Request('http://localhost/voice/preview?agentDbId=a1&token=abc', {
        headers: { Upgrade: 'websocket' },
      });

      const res = await app.fetch(req);
      expect(res.status).toBe(400);
      expect(await res.text()).toBe('Missing agentDbId or tenantId');
    });

    it('should return 401 when token is missing', async () => {
      const req = new Request('http://localhost/voice/preview?agentDbId=a1&tenantId=t1', {
        headers: { Upgrade: 'websocket' },
      });

      const res = await app.fetch(req);
      expect(res.status).toBe(401);
      expect(await res.text()).toBe('Missing token');
    });

    it('should return 401 when token is expired', async () => {
      const expiredToken = createValidToken('agent123', 'tenant123', -1000); // expired 1 second ago

      const req = new Request(
        `http://localhost/voice/preview?agentDbId=agent123&tenantId=tenant123&token=${encodeURIComponent(expiredToken)}`,
        { headers: { Upgrade: 'websocket' } }
      );

      const res = await app.fetch(req);
      expect(res.status).toBe(401);
      expect(await res.text()).toBe('Token expired');
    });

    it('should return 401 when token agentDbId does not match', async () => {
      const token = createValidToken('different-agent', 'tenant123');

      const req = new Request(
        `http://localhost/voice/preview?agentDbId=agent123&tenantId=tenant123&token=${encodeURIComponent(token)}`,
        { headers: { Upgrade: 'websocket' } }
      );

      const res = await app.fetch(req);
      expect(res.status).toBe(401);
      expect(await res.text()).toBe('Token mismatch');
    });

    it('should return 401 when token tenantId does not match', async () => {
      const token = createValidToken('agent123', 'different-tenant');

      const req = new Request(
        `http://localhost/voice/preview?agentDbId=agent123&tenantId=tenant123&token=${encodeURIComponent(token)}`,
        { headers: { Upgrade: 'websocket' } }
      );

      const res = await app.fetch(req);
      expect(res.status).toBe(401);
      expect(await res.text()).toBe('Token mismatch');
    });

    it('should return 401 when token is invalid', async () => {
      const req = new Request(
        'http://localhost/voice/preview?agentDbId=agent123&tenantId=tenant123&token=invalid-token',
        { headers: { Upgrade: 'websocket' } }
      );

      const res = await app.fetch(req);
      expect(res.status).toBe(401);
      expect(await res.text()).toBe('Invalid token');
    });

    it('should return 400 when Upgrade header is missing', async () => {
      const token = createValidToken('agent123', 'tenant123');

      const req = new Request(
        `http://localhost/voice/preview?agentDbId=agent123&tenantId=tenant123&token=${encodeURIComponent(token)}`
      );

      const res = await app.fetch(req);
      expect(res.status).toBe(400);
      expect(await res.text()).toBe('Expected WebSocket');
    });

    it('should proxy to Durable Object with valid params and token', async () => {
      const token = createValidToken('agent123', 'tenant123');

      const req = new Request(
        `http://localhost/voice/preview?agentDbId=agent123&tenantId=tenant123&token=${encodeURIComponent(token)}`,
        { headers: { Upgrade: 'websocket' } }
      );

      const res = await app.fetch(req);

      expect(mockDoNamespace.idFromName).toHaveBeenCalledWith('preview-tenant123-agent123');
      expect(mockDoNamespace.get).toHaveBeenCalledWith('mock-do-id');
      expect(res.status).toBe(200);
    });
  });
});
