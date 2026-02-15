import { DurableObject } from 'cloudflare:workers';
import { convexQuery, convexMutation } from '../convex/client';
import { DeepgramVoicePipeline, base64ToUint8Array, uint8ArrayToBase64 } from './deepgramPipeline';

export interface VoiceCallSessionEnv {
  DEEPGRAM_API_KEY: string;
  OPENROUTER_API_KEY?: string;
  OPENAI_API_KEY?: string;
  CONVEX_URL: string;
}

export interface VoiceConfig {
  numberId: string;
  tenantId: string;
  agentDbId: string;
  agentId?: string; // String identifier used for tool lookup (optional for fallback)
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

const FALLBACK_CONFIG: Omit<VoiceConfig, 'numberId' | 'tenantId' | 'agentId' | 'agentDbId' | 'voiceAgentId' | 'phoneNumber'> = {
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

export class VoiceCallSession extends DurableObject<VoiceCallSessionEnv> {
  private callSid?: string;
  private numberId?: string;
  private conversationId?: string;
  private agentId?: string;
  private twilioSocket?: WebSocket;
  private streamSid?: string;
  private pipeline?: DeepgramVoicePipeline;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade') || '';

    if (upgradeHeader.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    this.callSid = url.searchParams.get('callSid') || undefined;
    this.numberId = url.searchParams.get('numberId') || undefined;
    this.conversationId = url.searchParams.get('conversationId') || undefined;
    this.agentId = undefined;

    if (!this.callSid) {
      return new Response('Missing callSid', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    this.ctx.acceptWebSocket(server);
    this.twilioSocket = server;

    console.log(`[VoiceCallSession] Accepted WebSocket for callSid=${this.callSid}, numberId=${this.numberId}`);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') {
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }

    if (parsed.event === 'start') {
      this.streamSid = parsed.start?.streamSid;
      console.log(`[VoiceCallSession] Received Twilio start event for callSid=${this.callSid}`);
      if (!this.pipeline) {
        try {
          await this.initializeSession();
        } catch (error) {
          console.error('[VoiceCallSession] Failed to initialize Deepgram pipeline:', error);
        }
      }
      return;
    }

    if (parsed.event === 'media' && this.pipeline) {
      const payload = parsed.media?.payload as string | undefined;
      if (payload) {
        const audio = base64ToUint8Array(payload);
        this.pipeline.handleAudio(audio);
      }
      return;
    }

    if (parsed.event === 'stop') {
      console.log(`[VoiceCallSession] Received Twilio stop event for callSid=${this.callSid}`);
      await this.cleanup();
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    console.log(`[VoiceCallSession] WebSocket closed: code=${code}, reason=${reason}, callSid=${this.callSid}`);

    await this.cleanup();

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
    await this.cleanup();

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

  private async initializeSession(): Promise<void> {
    // Load voice config from Convex
    const config = await this.loadVoiceConfig();

    if (!this.twilioSocket) {
      throw new Error('Missing Twilio socket');
    }

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
        encoding: 'mulaw',
        sampleRate: 8000,
      },
      output: {
        encoding: 'mulaw',
        sampleRate: 8000,
      },
      onAudio: (audio) => this.sendTwilioAudio(audio),
      onInterrupt: () => this.sendTwilioInterrupt(),
      onTranscriptFinal: async (text, meta) => {
        await this.appendConversationEvent({
          eventType: 'message',
          role: 'user',
          content: text,
          metadata: {
            channel: 'voice',
            source: 'twilio',
            callSid: this.callSid,
            utteranceId: meta.utteranceId,
          },
        });
      },
      onAssistantMessage: async (text, meta) => {
        await this.appendConversationEvent({
          eventType: 'message',
          role: 'assistant',
          content: text,
          metadata: {
            channel: 'voice',
            source: 'twilio',
            callSid: this.callSid,
            responseId: meta.responseId,
          },
        });
      },
    });

    await this.pipeline.start();

    console.log(`[VoiceCallSession] Deepgram pipeline started for callSid=${this.callSid}`);
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

      console.log(`[VoiceCallSession] Loaded voice config for agent: ${config.agentName}`);

      this.agentId = config.agentId;

      return {
        ...FALLBACK_CONFIG,
        ...config,
      };
    } catch (error) {
      console.error('[VoiceCallSession] Failed to load voice config:', error);
      return FALLBACK_CONFIG;
    }
  }

  private async appendConversationEvent(event: {
    eventType: string;
    role?: string;
    content?: string;
    metadata?: unknown;
  }): Promise<void> {
    if (!this.conversationId || !this.agentId || !this.env.CONVEX_URL) {
      return;
    }

    try {
      await convexMutation(this.env.CONVEX_URL, 'conversations:appendEvent', {
        agentId: this.agentId,
        conversationId: this.conversationId,
        event,
      });
    } catch (error) {
      console.error('[VoiceCallSession] Failed to append conversation event:', error);
    }
  }

  private async cleanup(): Promise<void> {
    if (this.pipeline) {
      try {
        const usage = this.pipeline.getUsage();
        if (this.callSid && this.env.CONVEX_URL) {
          await convexMutation(this.env.CONVEX_URL, 'voiceCalls:updateUsage', {
            twilioCallSid: this.callSid,
            sttUsageSec: Math.round(usage.sttUsageSec),
            ttsCharacters: usage.ttsCharacters,
          });
        }
        await this.pipeline.stop();
      } catch (error) {
        console.error('[VoiceCallSession] Error during pipeline cleanup:', error);
      }
    }
    this.pipeline = undefined;
  }

  private sendTwilioAudio(audio: ArrayBuffer): void {
    if (!this.twilioSocket || !this.streamSid) return;
    const payload = uint8ArrayToBase64(new Uint8Array(audio));
    const message = JSON.stringify({
      event: 'media',
      streamSid: this.streamSid,
      media: { payload },
    });
    this.twilioSocket.send(message);
  }

  private sendTwilioInterrupt(): void {
    if (!this.twilioSocket || !this.streamSid) return;
    this.twilioSocket.send(
      JSON.stringify({
        event: 'clear',
        streamSid: this.streamSid,
      })
    );
  }
}
