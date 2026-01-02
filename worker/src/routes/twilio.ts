import { Hono } from 'hono';
import type { DurableObjectNamespace } from '@cloudflare/workers-types';

type Bindings = {
  OPENAI_API_KEY: string;
  VOICE_CALL_SESSION: DurableObjectNamespace;
};

const twilioRoutes = new Hono<{ Bindings: Bindings }>();

twilioRoutes.post('/voice', async (c) => {
  const formData = await c.req.formData();
  const to = formData.get('To') as string;
  const from = formData.get('From') as string;
  const callSid = formData.get('CallSid') as string;

  console.log(`[Twilio] Incoming call: from=${from}, to=${to}, callSid=${callSid}`);

  if (!callSid) {
    return c.text(
      `<?xml version="1.0"?>
<Response>
  <Say>Sorry, there was an error processing your call.</Say>
  <Hangup/>
</Response>`,
      200,
      { 'Content-Type': 'text/xml' }
    );
  }

  const host = c.req.header('Host');
  const protocol = c.req.header('X-Forwarded-Proto') || 'https';
  const wsProtocol = protocol === 'https' ? 'wss' : 'ws';

  const numberId = 'hardcoded-number';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Hello! Please wait while I connect you to the assistant.</Say>
  <Connect>
    <Stream url="${wsProtocol}://${host}/twilio/media?callSid=${encodeURIComponent(callSid)}&amp;numberId=${encodeURIComponent(numberId)}"/>
  </Connect>
</Response>`;

  return c.text(twiml, 200, { 'Content-Type': 'text/xml' });
});

twilioRoutes.get('/media', async (c) => {
  const callSid = c.req.query('callSid');
  const numberId = c.req.query('numberId');

  if (!callSid || !numberId) {
    return c.text('Missing params', 400);
  }

  const upgradeHeader = c.req.header('Upgrade');
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return c.text('Expected WebSocket', 400);
  }

  console.log(`[Twilio] Media stream request: callSid=${callSid}, numberId=${numberId}`);

  const id = c.env.VOICE_CALL_SESSION.idFromName(callSid);
  const stub = c.env.VOICE_CALL_SESSION.get(id);

  const url = new URL(c.req.url);
  url.searchParams.set('callSid', callSid);
  url.searchParams.set('numberId', numberId);

  return stub.fetch(url.toString(), {
    headers: c.req.raw.headers,
  });
});

twilioRoutes.post('/status', async (c) => {
  const formData = await c.req.formData();
  const callSid = formData.get('CallSid') as string;
  const callStatus = formData.get('CallStatus') as string;
  const callDuration = formData.get('CallDuration') as string;

  console.log(
    `[Twilio] Call status update: callSid=${callSid}, status=${callStatus}, duration=${callDuration}`
  );

  return c.text('OK', 200);
});

export default twilioRoutes;
