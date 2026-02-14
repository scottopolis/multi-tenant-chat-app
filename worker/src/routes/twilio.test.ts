import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import twilioRoutes from './twilio';

// Mock convex client
vi.mock('../convex/client', () => ({
  convexQuery: vi.fn(),
  convexMutation: vi.fn(),
}));

// Mock twilio signature verification
vi.mock('../voice/twilioSignature', () => ({
  verifyTwilioSignature: vi.fn().mockResolvedValue(true),
  formDataToObject: vi.fn((formData: FormData) => {
    const result: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === 'string') {
        result[key] = value;
      }
    }
    return result;
  }),
}));

import { convexQuery, convexMutation } from '../convex/client';
import { verifyTwilioSignature } from '../voice/twilioSignature';

describe('Twilio Routes', () => {
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
        VOICE_CALL_SESSION: mockDoNamespace,
        TWILIO_AUTH_TOKEN: 'test-auth-token',
      };
      await next();
    });
    app.route('/twilio', twilioRoutes);
  });

  describe('POST /twilio/voice', () => {
    it('should return TwiML with Media Stream URL when number is configured', async () => {
      const mockConfig = {
        numberId: 'num123',
        tenantId: 'tenant123',
        agentId: 'agent123',
        voiceAgentId: 'va123',
        phoneNumber: '+15551234567',
        sttProvider: 'deepgram',
        ttsProvider: 'deepgram',
        sttModel: 'nova-3',
        ttsModel: 'aura-2-thalia-en',
        ttsVoice: undefined,
        locale: 'en-US',
        bargeInEnabled: true,
        agentName: 'Test Agent',
        systemPrompt: 'You are helpful.',
      };

      vi.mocked(convexQuery).mockResolvedValue(mockConfig);
      vi.mocked(convexMutation).mockResolvedValue('call123');

      const formData = new FormData();
      formData.append('To', '+15551234567');
      formData.append('From', '+15559876543');
      formData.append('CallSid', 'CA1234567890');

      const req = new Request('http://localhost/twilio/voice', {
        method: 'POST',
        body: formData,
        headers: { Host: 'worker.example.com' },
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/xml');

      const body = await res.text();
      expect(body).toContain('<?xml version="1.0"');
      expect(body).toContain('<Response>');
      expect(body).toContain('<Stream url="wss://worker.example.com/twilio/media?callSid=CA1234567890&amp;numberId=num123"');
      expect(body).toContain('</Response>');

      expect(convexQuery).toHaveBeenCalledWith(
        'https://test.convex.cloud',
        'twilioNumbers:getByPhoneNumber',
        { phoneNumber: '+15551234567' }
      );
      expect(convexMutation).toHaveBeenCalledWith(
        'https://test.convex.cloud',
        'voiceCalls:create',
        expect.objectContaining({
          twilioCallSid: 'CA1234567890',
          fromNumber: '+15559876543',
          toNumber: '+15551234567',
        })
      );
    });

    it('should return not configured TwiML when number is not found', async () => {
      vi.mocked(convexQuery).mockResolvedValue(null);

      const formData = new FormData();
      formData.append('To', '+15551234567');
      formData.append('From', '+15559876543');
      formData.append('CallSid', 'CA1234567890');

      const req = new Request('http://localhost/twilio/voice', {
        method: 'POST',
        body: formData,
        headers: { Host: 'worker.example.com' },
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('<Say>Sorry, this number is not configured.</Say>');
      expect(body).toContain('<Hangup/>');
    });

    it('should return error TwiML when CallSid is missing', async () => {
      const formData = new FormData();
      formData.append('To', '+15551234567');
      formData.append('From', '+15559876543');

      const req = new Request('http://localhost/twilio/voice', {
        method: 'POST',
        body: formData,
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain('<Say>Sorry, there was an error processing your call.</Say>');
      expect(body).toContain('<Hangup/>');
    });

    it('should reject request with invalid Twilio signature', async () => {
      vi.mocked(verifyTwilioSignature).mockResolvedValue(false);

      const formData = new FormData();
      formData.append('To', '+15551234567');
      formData.append('From', '+15559876543');
      formData.append('CallSid', 'CA1234567890');

      const req = new Request('http://localhost/twilio/voice', {
        method: 'POST',
        body: formData,
        headers: {
          Host: 'worker.example.com',
          'X-Twilio-Signature': 'invalid-signature',
        },
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(403);
      expect(await res.text()).toBe('Forbidden');
    });
  });

  describe('GET /twilio/media', () => {
    it('should return 400 when callSid is missing', async () => {
      const req = new Request('http://localhost/twilio/media?numberId=123', {
        headers: { Upgrade: 'websocket' },
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(400);
      expect(await res.text()).toBe('Missing params');
    });

    it('should return 400 when numberId is missing', async () => {
      const req = new Request('http://localhost/twilio/media?callSid=CA123', {
        headers: { Upgrade: 'websocket' },
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(400);
      expect(await res.text()).toBe('Missing params');
    });

    it('should return 400 when Upgrade header is missing', async () => {
      const req = new Request('http://localhost/twilio/media?callSid=CA123&numberId=123');

      const res = await app.fetch(req);

      expect(res.status).toBe(400);
      expect(await res.text()).toBe('Expected WebSocket');
    });

    it('should proxy to Durable Object when params are valid', async () => {
      const req = new Request(
        'http://localhost/twilio/media?callSid=CA1234567890&numberId=num123',
        { headers: { Upgrade: 'websocket' } }
      );

      const res = await app.fetch(req);

      expect(mockDoNamespace.idFromName).toHaveBeenCalledWith('CA1234567890');
      expect(mockDoNamespace.get).toHaveBeenCalledWith('mock-do-id');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /twilio/status', () => {
    it('should update call status in Convex and return OK', async () => {
      vi.mocked(convexMutation).mockResolvedValue('call123');

      const formData = new FormData();
      formData.append('CallSid', 'CA1234567890');
      formData.append('CallStatus', 'completed');
      formData.append('CallDuration', '120');

      const req = new Request('http://localhost/twilio/status', {
        method: 'POST',
        body: formData,
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      expect(await res.text()).toBe('OK');
      expect(convexMutation).toHaveBeenCalledWith(
        'https://test.convex.cloud',
        'voiceCalls:updateStatus',
        {
          twilioCallSid: 'CA1234567890',
          status: 'completed',
          durationSec: 120,
        }
      );
      expect(convexMutation).toHaveBeenCalledWith(
        'https://test.convex.cloud',
        'voiceCalls:updateUsage',
        {
          twilioCallSid: 'CA1234567890',
          twilioDurationSec: 120,
        }
      );
    });

    it('should handle failed call status', async () => {
      vi.mocked(convexMutation).mockResolvedValue('call123');

      const formData = new FormData();
      formData.append('CallSid', 'CA1234567890');
      formData.append('CallStatus', 'failed');

      const req = new Request('http://localhost/twilio/status', {
        method: 'POST',
        body: formData,
      });

      const res = await app.fetch(req);

      expect(res.status).toBe(200);
      expect(convexMutation).toHaveBeenCalledWith(
        'https://test.convex.cloud',
        'voiceCalls:updateStatus',
        {
          twilioCallSid: 'CA1234567890',
          status: 'failed',
          durationSec: undefined,
        }
      );
    });
  });
});

describe('TwiML Generation', () => {
  it('should generate valid XML structure', async () => {
    vi.mocked(convexQuery).mockResolvedValue({
      numberId: 'num123',
      tenantId: 'tenant123',
      agentId: 'agent123',
      voiceAgentId: 'va123',
      phoneNumber: '+15551234567',
      sttProvider: 'deepgram',
      ttsProvider: 'deepgram',
      sttModel: 'nova-3',
      ttsModel: 'aura-2-thalia-en',
      ttsVoice: undefined,
      agentName: 'Test',
      systemPrompt: 'Test',
    });
    vi.mocked(convexMutation).mockResolvedValue('call123');

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.env = {
        DEEPGRAM_API_KEY: 'test-api-key',
        CONVEX_URL: 'https://test.convex.cloud',
        VOICE_CALL_SESSION: {
          idFromName: vi.fn(),
          get: vi.fn(),
        },
      };
      await next();
    });
    app.route('/twilio', twilioRoutes);

    const formData = new FormData();
    formData.append('To', '+15551234567');
    formData.append('From', '+15559876543');
    formData.append('CallSid', 'CA123');

    const req = new Request('http://localhost/twilio/voice', {
      method: 'POST',
      body: formData,
      headers: { Host: 'test.example.com' },
    });

    const res = await app.fetch(req);
    const body = await res.text();

    expect(body).toMatch(/^<\?xml version="1\.0"/);
    expect(body).toContain('<Connect>');
    expect(body).toContain('<Stream');
    expect(body).toContain('</Connect>');
    expect(body).toContain('</Response>');
  });
});
