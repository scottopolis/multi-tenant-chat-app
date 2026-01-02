import { DurableObject } from 'cloudflare:workers';
import { RealtimeSession, RealtimeAgent } from '@openai/agents/realtime';
import { TwilioRealtimeTransportLayer } from '@openai/agents-extensions';

export interface VoiceCallSessionEnv {
  OPENAI_API_KEY: string;
}

interface HardcodedAgentConfig {
  name: string;
  systemPrompt: string;
  voiceModel: string;
  voiceName: string;
}

const HARDCODED_AGENT_CONFIG: HardcodedAgentConfig = {
  name: 'Voice Assistant',
  systemPrompt: 'You are a helpful voice assistant. Keep responses brief and conversational.',
  voiceModel: 'gpt-4o-realtime-preview',
  voiceName: 'verse',
};

export class VoiceCallSession extends DurableObject<VoiceCallSessionEnv> {
  private session?: RealtimeSession;
  private callSid?: string;
  private twilioTransport?: TwilioRealtimeTransportLayer;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade') || '';

    if (upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    this.callSid = url.searchParams.get('callSid') || undefined;
    const numberId = url.searchParams.get('numberId');

    if (!this.callSid) {
      return new Response('Missing callSid', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    this.ctx.acceptWebSocket(server);

    console.log(`[VoiceCallSession] Accepted WebSocket for callSid=${this.callSid}`);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (!this.twilioTransport && typeof message === 'string') {
      try {
        const parsed = JSON.parse(message);
        if (parsed.event === 'connected' || parsed.event === 'start') {
          console.log(`[VoiceCallSession] Received Twilio ${parsed.event} event, initializing session`);
          await this.initializeSession(ws);
        }
      } catch {
        // Not JSON, ignore
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    console.log(`[VoiceCallSession] WebSocket closed: code=${code}, reason=${reason}, callSid=${this.callSid}`);

    if (this.session) {
      try {
        this.twilioTransport?.close();
      } catch (error) {
        console.error('[VoiceCallSession] Error closing session:', error);
      }
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('[VoiceCallSession] WebSocket error:', error);
  }

  private async initializeSession(twilioSocket: WebSocket): Promise<void> {
    const config = HARDCODED_AGENT_CONFIG;

    const agent = new RealtimeAgent({
      name: config.name,
      instructions: config.systemPrompt,
    });

    this.twilioTransport = new TwilioRealtimeTransportLayer({
      twilioWebSocket: twilioSocket as any,
    });

    this.session = new RealtimeSession(agent, {
      transport: this.twilioTransport,
      model: config.voiceModel as 'gpt-4o-realtime-preview',
      config: {
        audio: {
          output: { voice: config.voiceName as 'verse' },
        },
      },
    });

    this.session.on('error', (error) => {
      console.error('[VoiceCallSession] Session error:', error);
    });

    await this.session.connect({
      apiKey: this.env.OPENAI_API_KEY,
    });

    console.log(`[VoiceCallSession] Connected to OpenAI Realtime API for callSid=${this.callSid}`);
  }
}
