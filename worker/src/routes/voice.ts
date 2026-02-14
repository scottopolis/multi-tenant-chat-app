import { Hono } from 'hono';
import type { DurableObjectNamespace } from '@cloudflare/workers-types';

type Bindings = {
  DEEPGRAM_API_KEY: string;
  CONVEX_URL: string;
  WEB_VOICE_SESSION: DurableObjectNamespace;
};

export interface PreviewTokenValidation {
  valid: boolean;
  agentDbId: string;
  tenantId: string;
}

const voiceRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * POST /voice/preview/token
 * Generate a preview session token for browser voice testing
 * 
 * Body: { agentDbId: string, tenantId: string }
 * Returns: { token: string }
 */
voiceRoutes.post('/preview/token', async (c) => {
  const body = await c.req.json();
  const { agentDbId, tenantId } = body;

  if (!agentDbId || !tenantId) {
    return c.json({ error: 'Missing agentDbId or tenantId' }, 400);
  }

  // Generate a simple time-limited token
  // In production, this should be a proper JWT with signature verification
  const payload = {
    agentDbId,
    tenantId,
    exp: Date.now() + 5 * 60 * 1000, // 5 minute expiry
  };

  const token = btoa(JSON.stringify(payload));

  return c.json({ token });
});

/**
 * GET /voice/preview
 * WebSocket endpoint for browser voice preview
 * 
 * Query params:
 * - agentDbId: The agent's database ID
 * - tenantId: The tenant ID
 * - token: Preview session token from /voice/preview/token
 */
voiceRoutes.get('/preview', async (c) => {
  const agentDbId = c.req.query('agentDbId');
  const tenantId = c.req.query('tenantId');
  const token = c.req.query('token');

  if (!agentDbId || !tenantId) {
    return c.text('Missing agentDbId or tenantId', 400);
  }

  if (!token) {
    return c.text('Missing token', 401);
  }

  // Validate token
  try {
    const payload = JSON.parse(atob(token));
    
    if (payload.exp < Date.now()) {
      return c.text('Token expired', 401);
    }

    if (payload.agentDbId !== agentDbId || payload.tenantId !== tenantId) {
      return c.text('Token mismatch', 401);
    }
  } catch {
    return c.text('Invalid token', 401);
  }

  const upgradeHeader = c.req.header('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return c.text('Expected WebSocket', 400);
  }

  console.log(`[Voice] Preview request: agentDbId=${agentDbId}, tenantId=${tenantId}`);

  // Use stable session ID per agent+tenant to avoid creating duplicate DOs
  // The DO will reject if already in use via webSocketMessage
  const sessionId = `preview-${tenantId}-${agentDbId}`;
  const id = c.env.WEB_VOICE_SESSION.idFromName(sessionId);
  const stub = c.env.WEB_VOICE_SESSION.get(id);

  const url = new URL(c.req.url);
  url.searchParams.set('agentDbId', agentDbId);
  url.searchParams.set('tenantId', tenantId);

  return stub.fetch(url.toString(), {
    headers: c.req.raw.headers,
  });
});

export default voiceRoutes;
