import { DurableObject } from 'cloudflare:workers';
import { RealtimeSession, RealtimeAgent } from '@openai/agents/realtime';
import { TwilioRealtimeTransportLayer } from '@openai/agents-extensions';
import { convexQuery, convexMutation } from '../convex/client';
import { getTools } from '../tools';

export interface VoiceCallSessionEnv {
  OPENAI_API_KEY: string;
  CONVEX_URL: string;
}

export interface VoiceConfig {
  numberId: string;
  tenantId: string;
  agentDbId: string;
  agentId?: string; // String identifier used for tool lookup (optional for fallback)
  voiceAgentId: string;
  phoneNumber: string;
  voiceModel: string;
  voiceName?: string;
  locale: string;
  bargeInEnabled: boolean;
  agentName: string;
  systemPrompt: string;
}

const FALLBACK_CONFIG: Omit<VoiceConfig, 'numberId' | 'tenantId' | 'agentId' | 'agentDbId' | 'voiceAgentId' | 'phoneNumber'> = {
  voiceModel: 'gpt-4o-realtime-preview',
  voiceName: 'verse',
  locale: 'en-US',
  bargeInEnabled: true,
  agentName: 'Voice Assistant',
  systemPrompt: 'You are a helpful voice assistant. Keep responses brief and conversational.',
};

export class VoiceCallSession extends DurableObject<VoiceCallSessionEnv> {
  private session?: RealtimeSession;
  private callSid?: string;
  private numberId?: string;
  private voiceConfig?: VoiceConfig;
  private twilioTransport?: TwilioRealtimeTransportLayer;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade') || '';

    if (upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    this.callSid = url.searchParams.get('callSid') || undefined;
    this.numberId = url.searchParams.get('numberId') || undefined;

    if (!this.callSid) {
      return new Response('Missing callSid', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    this.ctx.acceptWebSocket(server);

    console.log(`[VoiceCallSession] Accepted WebSocket for callSid=${this.callSid}, numberId=${this.numberId}`);

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

    // Update call status to completed
    if (this.callSid && this.env.CONVEX_URL) {
      try {
        await convexMutation(this.env.CONVEX_URL, 'voiceCalls:updateStatus', {
          twilioCallSid: this.callSid,
          status: 'completed',
        });
        console.log(`[VoiceCallSession] Updated call status to completed: ${this.callSid}`);
      } catch (error) {
        console.error('[VoiceCallSession] Failed to update call status:', error);
      }
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('[VoiceCallSession] WebSocket error:', error);

    // Update call status to failed
    if (this.callSid && this.env.CONVEX_URL) {
      try {
        await convexMutation(this.env.CONVEX_URL, 'voiceCalls:updateStatus', {
          twilioCallSid: this.callSid,
          status: 'failed',
        });
      } catch (err) {
        console.error('[VoiceCallSession] Failed to update call status:', err);
      }
    }
  }

  private async initializeSession(twilioSocket: WebSocket): Promise<void> {
    // Load voice config from Convex
    const config = await this.loadVoiceConfig();

    // Load tools for the agent
    const tools = config.agentId 
      ? await getTools(config.agentId, { CONVEX_URL: this.env.CONVEX_URL }, { 
          convexUrl: this.env.CONVEX_URL 
        })
      : [];

    const agent = new RealtimeAgent({
      name: config.agentName,
      instructions: config.systemPrompt,
      tools,
    });

    this.twilioTransport = new TwilioRealtimeTransportLayer({
      twilioWebSocket: twilioSocket as any,
    });

    this.session = new RealtimeSession(agent, {
      transport: this.twilioTransport,
      model: config.voiceModel as 'gpt-4o-realtime-preview',
      config: {
        audio: {
          output: { voice: (config.voiceName || 'verse') as 'verse' },
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

  private async loadVoiceConfig(): Promise<typeof FALLBACK_CONFIG & Partial<VoiceConfig>> {
    if (!this.numberId || !this.env.CONVEX_URL) {
      console.log('[VoiceCallSession] No numberId or CONVEX_URL, using fallback config');
      return FALLBACK_CONFIG;
    }

    try {
      // Query voice config by numberId (Convex ID)
      const config = await convexQuery<VoiceConfig>(
        this.env.CONVEX_URL,
        'twilioNumbers:getById',
        { id: this.numberId }
      );

      if (!config) {
        console.log(`[VoiceCallSession] No config found for numberId=${this.numberId}, using fallback`);
        return FALLBACK_CONFIG;
      }

      this.voiceConfig = config;
      console.log(`[VoiceCallSession] Loaded voice config for agent: ${config.agentName}`);

      return {
        ...FALLBACK_CONFIG,
        ...config,
      };
    } catch (error) {
      console.error('[VoiceCallSession] Failed to load voice config:', error);
      return FALLBACK_CONFIG;
    }
  }
}
