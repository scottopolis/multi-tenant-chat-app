import { DurableObject } from 'cloudflare:workers';
import { convexQuery } from '../convex/client';
import { DeepgramVoicePipeline } from './deepgramPipeline';

export interface WebVoiceSessionEnv {
  DEEPGRAM_API_KEY: string;
  OPENROUTER_API_KEY?: string;
  OPENAI_API_KEY?: string;
  CONVEX_URL: string;
}

export interface WebVoiceConfig {
  agentDbId: string;
  agentId?: string; // String identifier used for tool lookup (optional for fallback)
  tenantId: string;
  agentName: string;
  systemPrompt: string;
  sttProvider: string;
  ttsProvider: string;
  sttModel: string;
  ttsModel: string;
  ttsVoice?: string;
  locale: string;
  bargeInEnabled: boolean;
}

const FALLBACK_CONFIG: Omit<WebVoiceConfig, 'agentDbId' | 'tenantId'> = {
  sttProvider: 'deepgram',
  ttsProvider: 'deepgram',
  sttModel: 'nova-3',
  ttsModel: 'aura-2-thalia-en',
  ttsVoice: undefined,
  locale: 'en-US',
  bargeInEnabled: true,
  agentName: 'Voice Assistant',
  systemPrompt: 'You are a helpful voice assistant. Keep responses brief and conversational.',
};

const MAX_SESSION_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export class WebVoiceSession extends DurableObject<WebVoiceSessionEnv> {
  private agentDbId?: string;
  private tenantId?: string;
  private pipeline?: DeepgramVoicePipeline;

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
    console.log(`[WebVoiceSession] Accepted WebSocket for agentDbId=${this.agentDbId}, tenantId=${this.tenantId}`);

    // Set alarm for max session duration
    await this.ctx.storage.setAlarm(Date.now() + MAX_SESSION_DURATION_MS);

    // Initialize the session immediately for web preview
    await this.initializeSession(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (this.pipeline && message instanceof ArrayBuffer) {
      this.pipeline.handleAudio(new Uint8Array(message));
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
    if (this.pipeline) {
      try {
        await this.pipeline.stop();
      } catch (error) {
        console.error('[WebVoiceSession] Error closing transport:', error);
      }
    }
    this.pipeline = undefined;
  }

  private async initializeSession(browserSocket: WebSocket): Promise<void> {
    const config = await this.loadVoiceConfig();

    this.pipeline = new DeepgramVoicePipeline({
      config: {
        agentId: config.agentId,
        agentName: config.agentName,
        systemPrompt: config.systemPrompt,
        locale: config.locale,
        bargeInEnabled: config.bargeInEnabled,
        sttModel: config.sttModel,
        ttsModel: config.ttsModel,
        ttsVoice: config.ttsVoice,
      },
      env: {
        DEEPGRAM_API_KEY: this.env.DEEPGRAM_API_KEY,
        OPENROUTER_API_KEY: this.env.OPENROUTER_API_KEY,
        OPENAI_API_KEY: this.env.OPENAI_API_KEY,
        CONVEX_URL: this.env.CONVEX_URL,
      },
      input: {
        encoding: 'linear16',
        sampleRate: 24000,
      },
      output: {
        encoding: 'linear16',
        sampleRate: 24000,
      },
      onAudio: (audio) => {
        if (browserSocket.readyState === WebSocket.OPEN) {
          browserSocket.send(audio);
        }
      },
      onInterrupt: () => {
        if (browserSocket.readyState === WebSocket.OPEN) {
          browserSocket.send(JSON.stringify({ type: 'interrupt' }));
        }
      },
    });

    try {
      await this.pipeline.start();
    } catch (error) {
      console.error('[WebVoiceSession] Failed to start Deepgram pipeline:', error);
      browserSocket.close(1011, 'Voice pipeline failed');
      return;
    }

    console.log(`[WebVoiceSession] Deepgram pipeline started for agentDbId=${this.agentDbId}`);
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
