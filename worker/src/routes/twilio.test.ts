import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import twilioRoutes from './twilio';

describe('Twilio Routes', () => {
  let app: Hono;
  let mockDoNamespace: any;

  beforeEach(() => {
    mockDoNamespace = {
      idFromName: vi.fn().mockReturnValue('mock-do-id'),
      get: vi.fn().mockReturnValue({
        fetch: vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
      }),
    };

    app = new Hono();
    app.use('*', async (c, next) => {
      c.env = {
        OPENAI_API_KEY: 'test-api-key',
        VOICE_CALL_SESSION: mockDoNamespace,
      };
      await next();
    });
    app.route('/twilio', twilioRoutes);
  });

  describe('POST /twilio/voice', () => {
    it('should return TwiML with Media Stream URL', async () => {
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
      expect(body).toContain('<Stream url="wss://worker.example.com/twilio/media?callSid=CA1234567890');
      expect(body).toContain('</Response>');
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

    it('should encode CallSid properly in TwiML', async () => {
      const formData = new FormData();
      formData.append('To', '+15551234567');
      formData.append('From', '+15559876543');
      formData.append('CallSid', 'CA123&456=789');

      const req = new Request('http://localhost/twilio/voice', {
        method: 'POST',
        body: formData,
        headers: { Host: 'worker.example.com' },
      });

      const res = await app.fetch(req);
      const body = await res.text();

      expect(body).toContain('callSid=CA123%26456%3D789');
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
    it('should log call status and return OK', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

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
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('callSid=CA1234567890')
      );

      consoleSpy.mockRestore();
    });
  });
});

describe('TwiML Generation', () => {
  it('should generate valid XML structure', async () => {
    const app = new Hono();
    app.use('*', async (c, next) => {
      c.env = {
        OPENAI_API_KEY: 'test-api-key',
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
