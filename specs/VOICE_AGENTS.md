# Voice Agents Integration Spec

## Overview

Enable voice agent support via Twilio phone numbers connected to OpenAI's Realtime API. Tenants can:
1. Create voice agents in the dashboard
2. Add Twilio phone numbers mapped to agents
3. End users call the number and talk to the AI

---

## Architecture

```
┌─────────────┐      ┌─────────────────────────────────────────────────────────┐
│   Caller    │      │                   Cloudflare Workers                    │
│  (Phone)    │      │                                                         │
└──────┬──────┘      │  ┌─────────────────┐    ┌─────────────────────────────┐ │
       │             │  │   Main Worker   │    │   VoiceCallSession (DO)     │ │
       │ 1. Call     │  │   (Hono)        │    │   - One per CallSid         │ │
       ▼             │  │                 │    │   - Manages WS lifecycle    │ │
┌─────────────┐      │  │ /twilio/voice   │    │                             │ │
│   Twilio    │──────┼──│ /twilio/media   │────│ TwilioRealtimeTransport     │ │
│   (Phone)   │ 2,3  │  │ /twilio/status  │    │         ↕                   │ │
└─────────────┘      │  └─────────────────┘    │ CloudflareRealtimeTransport │ │
       │             │                         │         ↕                   │ │
       │             │                         │ RealtimeSession (Agent)     │ │
       │             │                         └─────────────────────────────┘ │
       │             └─────────────────────────────────────────────────────────┘
       │                                                   │
       │                                                   │ 4. Audio/Events
       │                                                   ▼
       │                                         ┌─────────────────┐
       │                                         │ OpenAI Realtime │
       │                                         │      API        │
       │                                         └─────────────────┘
       │
       └──────────────────────┐
                              ▼
                    ┌─────────────────┐
                    │     Convex      │
                    │  - voiceAgents  │
                    │  - twilioNumbers│
                    │  - voiceCalls   │
                    └─────────────────┘
```

### Call Flow

1. **Caller dials Twilio number**
2. **Twilio → Worker** (`POST /twilio/voice`): Returns TwiML with Media Stream URL
3. **Twilio → Worker** (`WS /twilio/media`): Opens WebSocket, proxied to Durable Object
4. **DO ↔ OpenAI Realtime**: Bidirectional audio/events via transport layers
5. **Call ends**: DO logs usage, updates `voiceCalls` record

---

## Infrastructure Changes

### 1. Durable Objects (Required)

Standard Cloudflare Workers can't maintain persistent WebSocket connections across requests. **Durable Objects** are required to:
- Hold the WebSocket connection for the call duration
- Bridge Twilio ↔ OpenAI Realtime transports
- Track call state and usage

**WebSocket Hibernation API**: Use `this.ctx.acceptWebSocket()` for long-duration calls (30+ minutes). The DO "sleeps" between audio frames, keeping the connection alive indefinitely without burning CPU time. Billing is based on actual CPU time, not wall-clock time.

**wrangler.toml additions:**
```toml
[[durable_objects.bindings]]
name = "VOICE_CALL_SESSION"
class_name = "VoiceCallSession"

[[migrations]]
tag = "v1"
new_classes = ["VoiceCallSession"]
```

### 2. New Worker Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/twilio/voice` | POST | TwiML webhook - returns Media Stream connection |
| `/twilio/media` | WS | WebSocket endpoint for Twilio Media Streams |
| `/twilio/status` | POST | (Optional) Call status callbacks for billing |

### 3. New Dependencies

```bash
npm install @openai/agents-extensions
# Provides: TwilioRealtimeTransportLayer, CloudflareRealtimeTransportLayer
```

### 4. Environment Variables

| Variable | Purpose |
|----------|---------|
| `TWILIO_AUTH_TOKEN` | Webhook signature verification (shared mode) |

---

## Database Schema (Convex)

### voiceAgents

Per-agent voice configuration. Extends existing agents with voice capabilities.

```typescript
// convex/schema.ts
voiceAgents: defineTable({
  tenantId: v.id("tenants"),
  agentId: v.id("agents"),
  voiceModel: v.string(),         // "gpt-realtime"
  voiceName: v.optional(v.string()), // TTS voice persona
  locale: v.string(),             // "en-US"
  bargeInEnabled: v.boolean(),    // Allow interruptions
  enabled: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_agent", ["agentId"])
  .index("by_tenant", ["tenantId"])
```

### twilioNumbers

Maps Twilio phone numbers to voice agents.

```typescript
twilioNumbers: defineTable({
  tenantId: v.id("tenants"),
  agentId: v.id("agents"),
  voiceAgentId: v.id("voiceAgents"),
  phoneNumber: v.string(),        // E.164: "+15551234567"
  description: v.optional(v.string()),
  twilioSid: v.optional(v.string()), // Twilio IncomingPhoneNumber SID
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_tenant", ["tenantId"])
  .index("by_phone", ["phoneNumber"]) // unique
  .index("by_agent", ["agentId"])
```

### voiceCalls

Call logs for analytics and billing.

```typescript
voiceCalls: defineTable({
  tenantId: v.id("tenants"),
  agentId: v.id("agents"),
  voiceAgentId: v.id("voiceAgents"),
  twilioNumberId: v.id("twilioNumbers"),
  twilioCallSid: v.string(),
  fromNumber: v.string(),
  toNumber: v.string(),
  status: v.union(
    v.literal("in_progress"),
    v.literal("completed"),
    v.literal("failed")
  ),
  startedAt: v.number(),
  endedAt: v.optional(v.number()),
  durationSec: v.optional(v.number()),
  // Usage tracking
  openaiInputTokens: v.optional(v.number()),
  openaiOutputTokens: v.optional(v.number()),
  openaiCostUsd: v.optional(v.number()),
  twilioDurationSec: v.optional(v.number()),
  twilioCostUsd: v.optional(v.number()),
})
  .index("by_tenant", ["tenantId", "startedAt"])
  .index("by_agent", ["agentId", "startedAt"])
  .index("by_callSid", ["twilioCallSid"])
```

---

## Worker Implementation

### VoiceCallSession Durable Object

Uses the **WebSocket Hibernation API** for long-duration calls:

```typescript
// worker/src/voice/VoiceCallSession.ts
import { DurableObject } from 'cloudflare:workers';
import { RealtimeSession, RealtimeAgent } from '@openai/agents/realtime';
import { TwilioRealtimeTransportLayer } from '@openai/agents-extensions';

export class VoiceCallSession extends DurableObject {
  private session?: RealtimeSession;
  private callSid?: string;

  async fetch(req: Request) {
    const url = new URL(req.url);
    const upgradeHeader = req.headers.get('Upgrade') || '';
    
    if (upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    // Store call metadata
    this.callSid = url.searchParams.get('callSid')!;
    const numberId = url.searchParams.get('numberId')!;

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    // Accept with hibernation - enables long-duration calls (30+ mins)
    // DO will sleep between messages, only billing for actual CPU time
    this.ctx.acceptWebSocket(server);

    // Initialize the Realtime session
    await this.initializeSession(server, numberId);
    
    return new Response(null, { status: 101, webSocket: client });
  }

  private async initializeSession(twilioSocket: WebSocket, numberId: string) {
    // 1. Load voice config from Convex
    const voiceConfig = await this.loadVoiceConfig(numberId);
    
    // 2. Create agent with tenant's config
    const agent = new RealtimeAgent({
      name: voiceConfig.agentName,
      instructions: voiceConfig.systemPrompt,
      tools: voiceConfig.tools,
    });

    // 3. Create Twilio transport
    const twilioTransport = new TwilioRealtimeTransportLayer({
      twilioWebSocket: twilioSocket,
    });

    // 4. Create session with transport
    this.session = new RealtimeSession(agent, {
      transport: twilioTransport,
      model: voiceConfig.voiceModel,
      config: {
        audio: {
          output: { voice: voiceConfig.voiceName || 'verse' },
        },
      },
    });

    // 5. Connect to OpenAI Realtime
    await this.session.connect({ apiKey: this.env.OPENAI_API_KEY });
  }

  // Hibernation API: called when WebSocket receives a message (DO wakes up)
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // TwilioRealtimeTransportLayer handles message routing internally
  }

  // Hibernation API: called when WebSocket closes (call ends)
  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    if (this.callSid) {
      await this.logCallCompletion(this.callSid);
    }
  }

  // Hibernation API: called on WebSocket error
  async webSocketError(ws: WebSocket, error: unknown) {
    console.error('WebSocket error:', error);
  }
}
```

### TwiML Webhook Route

```typescript
// worker/src/routes/twilio.ts
app.post('/twilio/voice', async (c) => {
  // 1. Parse Twilio request
  const formData = await c.req.formData();
  const to = formData.get('To') as string;
  const from = formData.get('From') as string;
  const callSid = formData.get('CallSid') as string;

  // 2. Verify Twilio signature (security)
  // const isValid = verifyTwilioSignature(c.req, c.env.TWILIO_AUTH_TOKEN);
  // if (!isValid) return c.text('Forbidden', 403);

  // 3. Look up phone number → agent mapping
  const numberConfig = await lookupTwilioNumber(to, c.env.CONVEX_URL);
  if (!numberConfig) {
    return c.text(`<?xml version="1.0"?>
      <Response>
        <Say>Sorry, this number is not configured.</Say>
        <Hangup/>
      </Response>`, 200, { 'Content-Type': 'text/xml' });
  }

  // 4. Log call start
  await createVoiceCallRecord({
    callSid,
    fromNumber: from,
    toNumber: to,
    ...numberConfig,
  });

  // 5. Return TwiML with Media Stream
  const host = c.req.header('Host');
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="wss://${host}/twilio/media?callSid=${callSid}&numberId=${numberConfig.numberId}"/>
      </Connect>
    </Response>`;

  return c.text(twiml, 200, { 'Content-Type': 'text/xml' });
});
```

### Media Stream WebSocket Route

```typescript
app.get('/twilio/media', async (c) => {
  const callSid = c.req.query('callSid');
  const numberId = c.req.query('numberId');

  if (!callSid || !numberId) {
    return c.text('Missing params', 400);
  }

  // Get DO instance keyed by CallSid
  const id = c.env.VOICE_CALL_SESSION.idFromName(callSid);
  const stub = c.env.VOICE_CALL_SESSION.get(id);

  // Proxy WebSocket to DO
  const url = new URL(c.req.url);
  return stub.fetch(url.toString(), {
    headers: c.req.raw.headers,
  });
});
```

---

## Web Voice Preview

Enable testing voice agents directly in the browser without requiring a Twilio phone number.

### Architecture

```
┌─────────────────┐      ┌─────────────────────────────────────────────────────────┐
│    Dashboard    │      │                   Cloudflare Workers                    │
│   (Browser)     │      │                                                         │
└────────┬────────┘      │  ┌─────────────────┐    ┌─────────────────────────────┐ │
         │               │  │   Main Worker   │    │   WebVoiceSession (DO)      │ │
         │ 1. Click      │  │   (Hono)        │    │   - One per sessionId       │ │
         │    "Preview"  │  │                 │    │   - Browser ↔ OpenAI bridge │ │
         ▼               │  │ /voice/preview  │────│                             │ │
   getUserMedia()        │  │                 │    │ WebRTC/WebSocket Audio      │ │
         │               │  └─────────────────┘    │         ↕                   │ │
         │ 2. Audio WS   │                         │ RealtimeSession (Agent)     │ │
         └───────────────┼─────────────────────────│                             │ │
                         │                         └─────────────────────────────┘ │
                         └─────────────────────────────────────────────────────────┘
                                                              │
                                                              │ 3. Audio/Events
                                                              ▼
                                                    ┌─────────────────┐
                                                    │ OpenAI Realtime │
                                                    │      API        │
                                                    └─────────────────┘
```

### Flow

1. User clicks "Preview Voice" button in dashboard
2. Browser requests microphone access via `getUserMedia()`
3. Dashboard opens WebSocket to `/voice/preview?agentId=xxx&token=xxx`
4. Worker creates `WebVoiceSession` Durable Object
5. DO connects to OpenAI Realtime API with agent config
6. Browser streams audio chunks over WebSocket (PCM16/24kHz)
7. DO bridges audio bidirectionally to OpenAI
8. User speaks and hears AI responses in real-time

### New Worker Route

| Route | Method | Purpose |
|-------|--------|---------|
| `/voice/preview` | WS | WebSocket for browser-based voice preview |

### WebVoiceSession Durable Object

```typescript
// worker/src/voice/WebVoiceSession.ts
import { DurableObject } from 'cloudflare:workers';
import { RealtimeSession, RealtimeAgent } from '@openai/agents/realtime';

export class WebVoiceSession extends DurableObject {
  private session?: RealtimeSession;

  async fetch(req: Request) {
    const url = new URL(req.url);
    const upgradeHeader = req.headers.get('Upgrade') || '';
    
    if (upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    const agentId = url.searchParams.get('agentId')!;
    
    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    this.ctx.acceptWebSocket(server);
    await this.initializeSession(server, agentId);
    
    return new Response(null, { status: 101, webSocket: client });
  }

  private async initializeSession(browserSocket: WebSocket, agentId: string) {
    // 1. Load voice config from Convex
    const voiceConfig = await this.loadVoiceConfig(agentId);
    
    // 2. Create agent with tenant's config
    const agent = new RealtimeAgent({
      name: voiceConfig.agentName,
      instructions: voiceConfig.systemPrompt,
      tools: voiceConfig.tools,
    });

    // 3. Create session - use direct WebSocket transport for browser audio
    this.session = new RealtimeSession(agent, {
      model: voiceConfig.voiceModel,
      config: {
        audio: {
          input: { format: 'pcm16', sampleRate: 24000 },
          output: { format: 'pcm16', sampleRate: 24000, voice: voiceConfig.voiceName || 'verse' },
        },
      },
    });

    // 4. Bridge browser WebSocket ↔ OpenAI Realtime
    await this.session.connect();
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    // Forward browser audio to OpenAI
    if (message instanceof ArrayBuffer) {
      this.session?.sendAudio(new Uint8Array(message));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    this.session?.disconnect();
  }
}
```

### Dashboard UI Component

```tsx
// dashboard/src/components/VoicePreview.tsx
function VoicePreview({ agentId }: { agentId: string }) {
  const [isActive, setIsActive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const startPreview = async () => {
    // 1. Get microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // 2. Set up audio processing
    audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    const source = audioContextRef.current.createMediaStreamSource(stream);
    const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    
    // 3. Connect to worker
    const token = await getPreviewToken(agentId);
    wsRef.current = new WebSocket(
      `wss://${WORKER_HOST}/voice/preview?agentId=${agentId}&token=${token}`
    );
    
    // 4. Stream audio to server
    processor.onaudioprocess = (e) => {
      const pcm16 = float32ToPcm16(e.inputBuffer.getChannelData(0));
      wsRef.current?.send(pcm16.buffer);
    };
    
    // 5. Play received audio
    wsRef.current.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) {
        playAudio(e.data, audioContextRef.current!);
      }
    };
    
    source.connect(processor);
    processor.connect(audioContextRef.current.destination);
    setIsActive(true);
  };

  const stopPreview = () => {
    wsRef.current?.close();
    audioContextRef.current?.close();
    setIsActive(false);
  };

  return (
    <Button onClick={isActive ? stopPreview : startPreview}>
      {isActive ? <MicOff /> : <Mic />}
      {isActive ? 'End Preview' : 'Preview Voice'}
    </Button>
  );
}
```

### Security

- Require valid dashboard session token in WebSocket query param
- Validate user has access to the agent's tenant
- Rate limit preview sessions per user (e.g., 5 concurrent max)
- Auto-disconnect after timeout (e.g., 10 minutes)

### Additions to wrangler.toml

```toml
[[durable_objects.bindings]]
name = "WEB_VOICE_SESSION"
class_name = "WebVoiceSession"

[[migrations]]
tag = "v2"
new_classes = ["WebVoiceSession"]
```

---

## Dashboard UI

### Agent Voice Tab

Add a "Voice" tab to the agent detail page:

1. **Enable Voice Toggle**
   - Creates/updates `voiceAgents` record

2. **Voice Settings**
   - Model: `gpt-realtime` (dropdown)
   - Voice persona: `verse`, `alloy`, etc.
   - Locale: `en-US`, `es-ES`, etc.
   - Barge-in enabled: checkbox

3. **Phone Numbers Section**
   - Table of linked numbers (from `twilioNumbers`)
   - Add Number button → modal:
     - Phone number (E.164 format)
     - Description
     - Twilio SID (optional)

4. **Integration Instructions**
   - Display webhook URL: `https://<worker>/twilio/voice`
   - Steps to configure in Twilio console

### Mock UI Layout

```
┌─────────────────────────────────────────────────────────┐
│ Agent: Acme Support                                      │
├─────────────────────────────────────────────────────────┤
│ [General] [Tools] [Knowledge] [Voice]                    │
├─────────────────────────────────────────────────────────┤
│ Voice Settings                                           │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ☑ Enable voice for this agent                       │ │
│ │                                                     │ │
│ │ Model:    [gpt-4o-realtime-preview ▼]               │ │
│ │ Voice:    [verse ▼]                                 │ │
│ │ Locale:   [en-US ▼]                                 │ │
│ │ ☑ Allow barge-in (interruptions)                    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Phone Numbers                                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ +1 (555) 123-4567  │ Main support line  │ [Remove]  │ │
│ │ +1 (555) 987-6543  │ Sales hotline      │ [Remove]  │ │
│ └─────────────────────────────────────────────────────┘ │
│ [+ Add Phone Number]                                     │
│                                                         │
│ Integration                                              │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Webhook URL: https://worker.example.com/twilio/voice│ │
│ │                                         [Copy]      │ │
│ │                                                     │ │
│ │ Configure this URL in Twilio Console:               │ │
│ │ Phone Numbers → Your Number → Voice Configuration   │ │
│ │ → "A Call Comes In" → Webhook → POST                │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Preview                                                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Test your voice agent directly in the browser.      │ │
│ │                                                     │ │
│ │          [🎤 Preview Voice]                         │ │
│ │                                                     │ │
│ │ No phone number required. Uses your microphone.     │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Security Considerations

### 1. Webhook Verification
- Validate `X-Twilio-Signature` on `/twilio/voice`
- Use per-tenant auth tokens if supporting BYO Twilio

### 2. WebSocket Security
- Only accept WS connections with valid `callSid` + `numberId`
- Optionally maintain short-lived `callSid → numberId` mapping from TwiML generation

### 3. Multi-Tenant Isolation
- Always derive `tenantId` from `twilioNumbers` lookup
- Never expose tenant secrets in Twilio-visible URLs
- DO only loads configs for the call's tenant

### 4. Rate Limiting
- Track concurrent calls per tenant
- Enforce `maxConcurrentVoiceCalls` based on plan
- Reject new calls with polite TwiML if limit exceeded

---

## Billing & Usage Tracking

### OpenAI Usage
- RealtimeSession may expose usage events
- On session close: capture `input_tokens`, `output_tokens`
- Store in `voiceCalls` record

### Twilio Usage
- Use Status Callback (`/twilio/status`) to capture:
  - `CallDuration`
  - `CallStatus` (completed, busy, failed, etc.)
- Update `voiceCalls.twilioDurationSec`

### Dashboard Metrics (Future)
- Per-tenant usage page showing:
  - Voice minutes
  - Call count
  - OpenAI token usage
  - Estimated costs

---

## Implementation Phases

### Phase 1: Core Infrastructure (L) ✅
- [x] Add Durable Object (`VoiceCallSession`)
- [x] Add `/twilio/voice` TwiML endpoint
- [x] Add `/twilio/media` WebSocket proxy
- [x] Basic DO ↔ OpenAI Realtime bridge
- [x] Test with hardcoded agent config

### Phase 2: Multi-Tenant Support (M) ✅
- [x] Add `voiceAgents`, `twilioNumbers`, `voiceCalls` tables
- [x] Dynamic config loading in DO
- [x] Phone number → agent lookup
- [x] Twilio signature verification

### Phase 3: Dashboard UI (M) ✅
- [x] Voice tab on agent detail page
- [x] Voice settings form
- [x] Phone number management
- [x] Integration instructions display

### Phase 4: Web Voice Preview (M)
- [ ] Add `WebVoiceSession` Durable Object
- [ ] Add `/voice/preview` WebSocket route
- [ ] Dashboard VoicePreview component with mic access
- [ ] Browser audio capture (PCM16/24kHz)
- [ ] Audio playback from OpenAI responses
- [ ] Session token auth for preview endpoint

### Phase 5: Polish & Billing (S)
- [ ] Call status callbacks
- [ ] Usage tracking in `voiceCalls`
- [ ] Rate limiting per tenant
- [ ] Usage dashboard view

---

## Open Questions

1. **BYO Twilio**: Do we support tenants using their own Twilio accounts from day 1, or start with shared?
2. **Voice Recording**: Should we offer call recording? (regulatory implications)
3. **Transcript Storage**: Store full transcripts in Convex or just summaries?
4. **Tool Calling**: Which tools should be available in voice mode? (some may not make sense)
5. **Handoffs**: Support voice → text handoffs or agent → agent handoffs?

---

## References

- [OpenAI Agents SDK - Voice Quickstart](https://openai.github.io/openai-agents-js/guides/voice-agents/quickstart/)
- [OpenAI Agents SDK - Twilio Extension](https://openai.github.io/openai-agents-js/extensions/twilio/)
- [OpenAI Agents SDK - Cloudflare Extension](https://openai.github.io/openai-agents-js/extensions/cloudflare/)
- [Twilio Media Streams](https://www.twilio.com/docs/voice/media-streams)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)

---

*Last updated: January 2025*
