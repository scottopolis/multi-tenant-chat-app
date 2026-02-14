import { Hono } from 'hono';
import type { DurableObjectNamespace } from '@cloudflare/workers-types';
import { convexQuery, convexMutation } from '../convex/client';
import { verifyTwilioSignature, formDataToObject } from '../voice/twilioSignature';

type Bindings = {
  DEEPGRAM_API_KEY: string;
  CONVEX_URL: string;
  VOICE_CALL_SESSION: DurableObjectNamespace;
  TWILIO_AUTH_TOKEN?: string;
};

export interface TwilioNumberConfig {
  numberId: string;
  tenantId: string;
  agentId: string;
  voiceAgentId: string;
  phoneNumber: string;
  sttProvider: string;
  ttsProvider: string;
  sttModel: string;
  ttsModel: string;
  ttsVoice?: string;
  locale: string;
  bargeInEnabled: boolean;
  agentName: string;
  systemPrompt: string;
}

const twilioRoutes = new Hono<{ Bindings: Bindings }>();

twilioRoutes.post('/voice', async (c) => {
  const formData = await c.req.formData();
  const params = formDataToObject(formData);
  const to = params['To'] || '';
  const from = params['From'] || '';
  const callSid = params['CallSid'] || '';

  console.log(`[Twilio] Incoming call: from=${from}, to=${to}, callSid=${callSid}`);

  // Verify Twilio signature if auth token is configured
  if (c.env.TWILIO_AUTH_TOKEN) {
    const signature = c.req.header('X-Twilio-Signature') || '';
    const protocol = c.req.header('X-Forwarded-Proto') || 'https';
    const host = c.req.header('Host') || '';
    const url = `${protocol}://${host}/twilio/voice`;

    const isValid = await verifyTwilioSignature(
      c.env.TWILIO_AUTH_TOKEN,
      signature,
      url,
      params
    );

    if (!isValid) {
      console.warn('[Twilio] Invalid signature, rejecting request');
      return c.text('Forbidden', 403);
    }
  }

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

  // Look up phone number → agent mapping from Convex
  let numberConfig: TwilioNumberConfig | null = null;

  if (c.env.CONVEX_URL && to) {
    try {
      numberConfig = await convexQuery<TwilioNumberConfig>(
        c.env.CONVEX_URL,
        'twilioNumbers:getByPhoneNumber',
        { phoneNumber: to }
      );
    } catch (error) {
      console.error('[Twilio] Failed to lookup phone number:', error);
    }
  }

  if (!numberConfig) {
    console.log(`[Twilio] No config found for number ${to}`);
    return c.text(
      `<?xml version="1.0"?>
<Response>
  <Say>Sorry, this number is not configured.</Say>
  <Hangup/>
</Response>`,
      200,
      { 'Content-Type': 'text/xml' }
    );
  }

  // Create voice call record in Convex
  if (c.env.CONVEX_URL) {
    try {
      await convexMutation(c.env.CONVEX_URL, 'voiceCalls:create', {
        tenantId: numberConfig.tenantId,
        agentId: numberConfig.agentId,
        voiceAgentId: numberConfig.voiceAgentId,
        twilioNumberId: numberConfig.numberId,
        twilioCallSid: callSid,
        fromNumber: from,
        toNumber: to,
      });
      console.log(`[Twilio] Created voice call record for ${callSid}`);
    } catch (error) {
      console.error('[Twilio] Failed to create voice call record:', error);
    }
  }

  const host = c.req.header('Host');
  const protocol = c.req.header('X-Forwarded-Proto') || 'https';
  const wsProtocol = protocol === 'https' ? 'wss' : 'ws';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Hello! Please wait while I connect you to the assistant.</Say>
  <Connect>
    <Stream url="${wsProtocol}://${host}/twilio/media?callSid=${encodeURIComponent(callSid)}&amp;numberId=${encodeURIComponent(numberConfig.numberId)}"/>
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

  // Update call record in Convex
  if (c.env.CONVEX_URL && callSid) {
    try {
      const status =
        callStatus === 'completed'
          ? 'completed'
          : callStatus === 'failed' || callStatus === 'busy' || callStatus === 'no-answer'
            ? 'failed'
            : 'completed';

      await convexMutation(c.env.CONVEX_URL, 'voiceCalls:updateStatus', {
        twilioCallSid: callSid,
        status,
        durationSec: callDuration ? parseInt(callDuration, 10) : undefined,
      });

      // Update Twilio-specific usage
      if (callDuration) {
        await convexMutation(c.env.CONVEX_URL, 'voiceCalls:updateUsage', {
          twilioCallSid: callSid,
          twilioDurationSec: parseInt(callDuration, 10),
        });
      }

      console.log(`[Twilio] Updated call status for ${callSid}`);
    } catch (error) {
      console.error('[Twilio] Failed to update call status:', error);
    }
  }

  return c.text('OK', 200);
});

export default twilioRoutes;
