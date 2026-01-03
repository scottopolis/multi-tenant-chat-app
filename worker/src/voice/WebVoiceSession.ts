import { DurableObject } from 'cloudflare:workers';
import { RealtimeSession, RealtimeAgent } from '@openai/agents/realtime';
import { CloudflareRealtimeTransportLayer } from '@openai/agents-extensions';
import { convexQuery } from '../convex/client';

export interface WebVoiceSessionEnv {
  OPENAI_API_KEY: string;
  CONVEX_URL: string;
}

export interface WebVoiceConfig {
  agentDbId: string;
  tenantId: string;
  agentName: string;
  systemPrompt: string;
  voiceModel: string;
  voiceName?: string;
  locale: string;
  bargeInEnabled: boolean;
}

const FALLBACK_CONFIG: Omit<WebVoiceConfig, 'agentDbId' | 'tenantId'> = {
  voiceModel: 'gpt-4o-realtime-preview',
  voiceName: 'verse',
  locale: 'en-US',
  bargeInEnabled: true,
  agentName: 'Voice Assistant',
  systemPrompt: 'You are a helpful voice assistant. Keep responses brief and conversational.',
};

const MAX_SESSION_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export class WebVoiceSession extends DurableObject<WebVoiceSessionEnv> {
  private session?: RealtimeSession;
  private agentDbId?: string;
  private tenantId?: string;
  private cloudflareTransport?: CloudflareRealtimeTransportLayer;
  private browserSocket?: WebSocket;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade') || '';

    if (upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    this.agentDbId = url.searchParams.get('agentDbId') || undefined;
    this.tenantId = url.searchParams.get('tenantId') || undefined;

    if (!this.agentDbId) {
      return new Response('Missing agentDbId', { status: 400 });
    }

    if (!this.tenantId) {
      return new Response('Missing tenantId', { status: 400 });
    }

    // Clean up any existing session before starting a new one
    if (this.session) {
      console.log(`[WebVoiceSession] Cleaning up existing session before new connection`);
      await this.cleanup();
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    // Close any existing websockets from previous sessions
    for (const ws of this.ctx.getWebSockets()) {
      ws.close(1000, 'New session started');
    }

    this.ctx.acceptWebSocket(server);
    this.browserSocket = server;

    console.log(`[WebVoiceSession] Accepted WebSocket for agentDbId=${this.agentDbId}, tenantId=${this.tenantId}`);

    // Set alarm for max session duration
    await this.ctx.storage.setAlarm(Date.now() + MAX_SESSION_DURATION_MS);

    // Initialize the session immediately for web preview
    await this.initializeSession(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (this.session && message instanceof ArrayBuffer) {
      this.session.sendAudio(message);
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    console.log(`[WebVoiceSession] WebSocket closed: code=${code}, reason=${reason}, agentDbId=${this.agentDbId}`);
    await this.cleanup();
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.error('[WebVoiceSession] WebSocket error:', error);
    await this.cleanup();
  }

  async alarm(): Promise<void> {
    console.log(`[WebVoiceSession] Session timeout reached, closing connection`);
    await this.cleanup();

    // Close all websockets
    for (const ws of this.ctx.getWebSockets()) {
      ws.close(1000, 'Session timeout');
    }
  }

  private async cleanup(): Promise<void> {
    if (this.cloudflareTransport) {
      try {
        this.cloudflareTransport.close();
      } catch (error) {
        console.error('[WebVoiceSession] Error closing transport:', error);
      }
    }
    this.session = undefined;
    this.cloudflareTransport = undefined;
    this.browserSocket = undefined;
  }

  private async initializeSession(browserSocket: WebSocket): Promise<void> {
    const config = await this.loadVoiceConfig();

    const agent = new RealtimeAgent({
      name: config.agentName,
      instructions: config.systemPrompt,
    });

    // Create Cloudflare transport to connect to OpenAI Realtime API
    // This transport handles the fetch-based WebSocket upgrade required by workerd
    this.cloudflareTransport = new CloudflareRealtimeTransportLayer({
      url: `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(config.voiceModel)}`,
    });

    this.session = new RealtimeSession(agent, {
      transport: this.cloudflareTransport,
      model: config.voiceModel as 'gpt-4o-realtime-preview',
      config: {
        inputAudioFormat: 'pcm16',
        outputAudioFormat: 'pcm16',
        audio: {
          output: { voice: (config.voiceName || 'verse') as 'verse' },
        },
        turnDetection: {
          type: 'semantic_vad',
          eagerness: 'medium',
          createResponse: true,
          interruptResponse: true,
        },
      },
    });

    this.session.on('audio', (event) => {
      if (browserSocket.readyState === WebSocket.OPEN && event.data) {
        browserSocket.send(event.data);
      }
    });

    this.session.on('audio_interrupted', () => {
      if (browserSocket.readyState === WebSocket.OPEN) {
        browserSocket.send(JSON.stringify({ type: 'interrupt' }));
      }
    });

    this.session.on('error', (error) => {
      console.error('[WebVoiceSession] Session error:', error);
    });

    await this.session.connect({
      apiKey: this.env.OPENAI_API_KEY,
    });

    console.log(`[WebVoiceSession] Connected to OpenAI Realtime API for agentDbId=${this.agentDbId}`);
  }

  private async loadVoiceConfig(): Promise<typeof FALLBACK_CONFIG & Partial<WebVoiceConfig>> {
    if (!this.agentDbId || !this.env.CONVEX_URL) {
      console.log('[WebVoiceSession] No agentDbId or CONVEX_URL, using fallback config');
      return FALLBACK_CONFIG;
    }

    try {
      // Query voice config by agentDbId (Convex document ID)
      const config = await convexQuery<WebVoiceConfig>(
        this.env.CONVEX_URL,
        'voiceAgents:getConfigByAgentDbId',
        { agentDbId: this.agentDbId }
      );

      if (!config) {
        console.log(`[WebVoiceSession] No config found for agentDbId=${this.agentDbId}, using fallback`);
        return FALLBACK_CONFIG;
      }

      console.log(`[WebVoiceSession] Loaded voice config for agent: ${config.agentName}`);

      return {
        ...FALLBACK_CONFIG,
        ...config,
      };
    } catch (error) {
      console.error('[WebVoiceSession] Failed to load voice config:', error);
      return FALLBACK_CONFIG;
    }
  }
}
