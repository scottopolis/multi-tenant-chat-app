import { createClient, LiveTranscriptionEvents, LiveTTSEvents } from '@deepgram/sdk';
import { runAgentTanStack } from '../agents/tanstack';

export type DeepgramVoiceConfig = {
  agentId?: string;
  agentName: string;
  systemPrompt: string;
  locale: string;
  bargeInEnabled: boolean;
  sttModel: string;
  ttsModel: string;
  ttsVoice?: string;
};

export type DeepgramVoiceEnv = {
  DEEPGRAM_API_KEY: string;
  OPENROUTER_API_KEY?: string;
  OPENAI_API_KEY?: string;
  CONVEX_URL?: string;
};

export type AudioFormat = {
  encoding: 'linear16' | 'mulaw';
  sampleRate: number;
};

export type DeepgramVoicePipelineOptions = {
  config: DeepgramVoiceConfig;
  env: DeepgramVoiceEnv;
  input: AudioFormat;
  output: AudioFormat;
  onAudio: (audio: ArrayBuffer) => void;
  onInterrupt?: () => void;
  onTtsEnd?: () => void;
};

export class DeepgramVoicePipeline {
  private readonly config: DeepgramVoiceConfig;
  private readonly env: DeepgramVoiceEnv;
  private readonly input: AudioFormat;
  private readonly output: AudioFormat;
  private readonly onAudio: (audio: ArrayBuffer) => void;
  private readonly onInterrupt?: () => void;
  private readonly onTtsEnd?: () => void;
  private readonly deepgram = createClient;
  private sttConnection: any;
  private ttsConnection: any;
  private history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  private queue: string[] = [];
  private processing = false;
  private responseId = 0;
  private isSpeaking = false;
  private sttAudioBytes = 0;
  private ttsCharacters = 0;
  private sttReady = false;
  private pendingAudio: Uint8Array[] = [];
  private lastTranscript = '';

  constructor(options: DeepgramVoicePipelineOptions) {
    this.config = options.config;
    this.env = options.env;
    this.input = options.input;
    this.output = options.output;
    this.onAudio = options.onAudio;
    this.onInterrupt = options.onInterrupt;
    this.onTtsEnd = options.onTtsEnd;
  }

  async start(): Promise<void> {
    if (!this.env.DEEPGRAM_API_KEY) {
      throw new Error('Missing DEEPGRAM_API_KEY');
    }

    const client = this.deepgram(this.env.DEEPGRAM_API_KEY);

    this.sttConnection = client.listen.live({
      model: this.config.sttModel,
      encoding: this.input.encoding,
      sample_rate: this.input.sampleRate,
      interim_results: true,
      vad_events: true,
      utterance_end_ms: 1000,
      endpointing: 300,
      smart_format: true,
      language: this.config.locale,
    });

    this.sttConnection.on(LiveTranscriptionEvents.Open, () => {
      this.sttReady = true;
      console.log('[DeepgramPipeline] STT connection open');
      if (this.pendingAudio.length > 0) {
        for (const chunk of this.pendingAudio) {
          this.sttConnection.send(chunk);
        }
        this.pendingAudio = [];
      }
    });

    this.sttConnection.on(LiveTranscriptionEvents.Transcript, (data: any) => {
      const transcript = data?.channel?.alternatives?.[0]?.transcript?.trim();
      if (transcript) {
        console.log(
          `[DeepgramPipeline] Transcript${data.is_final ? ' (final)' : ''}: ${transcript}`
        );
      }
      if (!transcript) {
        return;
      }

      if (this.isSpeaking && !this.config.bargeInEnabled) {
        return;
      }

      if (!data.is_final && this.config.bargeInEnabled && this.isSpeaking) {
        this.interrupt();
      }

      if (data.is_final) {
        this.lastTranscript = '';
        this.enqueueTranscript(transcript);
        return;
      }

      this.lastTranscript = transcript;
    });

    this.sttConnection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      if (this.isSpeaking && !this.config.bargeInEnabled) {
        this.lastTranscript = '';
        return;
      }
      if (this.lastTranscript) {
        this.enqueueTranscript(this.lastTranscript);
        this.lastTranscript = '';
      }
    });

    this.sttConnection.on(LiveTranscriptionEvents.Error, (error: unknown) => {
      console.error('[DeepgramPipeline] STT error:', error);
    });

    this.sttConnection.on(LiveTranscriptionEvents.Close, () => {
      this.sttConnection = undefined;
      this.sttReady = false;
    });
  }

  handleAudio(data: Uint8Array): void {
    if (!this.sttConnection) {
      return;
    }
    this.sttAudioBytes += data.byteLength;
    if (!this.sttReady) {
      this.pendingAudio.push(data);
      return;
    }
    this.sttConnection.send(data);
  }

  async stop(): Promise<void> {
    this.queue = [];
    this.processing = false;
    this.responseId += 1;
    this.sttReady = false;
    this.pendingAudio = [];

    if (this.sttConnection?.finish) {
      this.sttConnection.finish();
    } else if (this.sttConnection?.close) {
      this.sttConnection.close();
    }

    if (this.ttsConnection?.finish) {
      this.ttsConnection.finish();
    } else if (this.ttsConnection?.close) {
      this.ttsConnection.close();
    }
  }

  getUsage() {
    const bytesPerSample = this.input.encoding === 'linear16' ? 2 : 1;
    const sttUsageSec = this.input.sampleRate > 0
      ? this.sttAudioBytes / (this.input.sampleRate * bytesPerSample)
      : 0;

    return {
      sttUsageSec,
      ttsCharacters: this.ttsCharacters,
    };
  }

  private interrupt(): void {
    this.responseId += 1;
    this.queue = [];
    this.isSpeaking = false;

    if (this.ttsConnection?.finish) {
      this.ttsConnection.finish();
    } else if (this.ttsConnection?.close) {
      this.ttsConnection.close();
    }

    if (this.onInterrupt) {
      this.onInterrupt();
    }
  }

  private enqueueTranscript(transcript: string): void {
    this.queue.push(transcript);
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const transcript = this.queue.shift();
      if (!transcript) continue;

      const currentResponseId = ++this.responseId;
      const response = await this.generateResponse(transcript, currentResponseId);
      if (!response || this.responseId !== currentResponseId) {
        continue;
      }

      await this.speakResponse(response, currentResponseId);
    }

    this.processing = false;
  }

  private async generateResponse(userText: string, responseId: number): Promise<string> {
    const apiKey = this.env.OPENROUTER_API_KEY || this.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[DeepgramPipeline] Missing OPENROUTER_API_KEY or OPENAI_API_KEY for LLM');
      return '';
    }
    console.log(`[DeepgramPipeline] Generating response for: ${userText}`);

    const messages = [...this.history, { role: 'user' as const, content: userText }];

    const stream = await runAgentTanStack({
      messages,
      apiKey,
      agentId: this.config.agentId || 'default',
      env: {
        CONVEX_URL: this.env.CONVEX_URL,
      },
    });

    let content = '';
    for await (const chunk of stream) {
      if (this.responseId !== responseId) {
        return '';
      }
      if (chunk.type === 'content' && chunk.delta) {
        content += chunk.delta;
      }
    }

    console.log(`[DeepgramPipeline] LLM response length: ${content.length}`);
    if (content) {
      this.history.push({ role: 'user', content: userText });
      this.history.push({ role: 'assistant', content });
    }

    return content;
  }

  private async speakResponse(text: string, responseId: number): Promise<void> {
    if (!text) return;

    this.isSpeaking = true;
    this.lastTranscript = '';
    this.ttsCharacters += text.length;

    const client = this.deepgram(this.env.DEEPGRAM_API_KEY);

    await new Promise<void>((resolve) => {
      const ttsOptions: Record<string, unknown> = {
        model: this.config.ttsModel,
        encoding: this.output.encoding,
        sample_rate: this.output.sampleRate,
      };

      if (this.config.ttsVoice) {
        ttsOptions.voice = this.config.ttsVoice;
      }

      const tts = client.speak.live(ttsOptions);

      this.ttsConnection = tts;

      tts.on(LiveTTSEvents.Open, () => {
        if (this.responseId !== responseId) {
          tts.finish?.();
          return;
        }
        tts.sendText(text);
        tts.flush();
      });

      tts.on(LiveTTSEvents.Audio, (data: unknown) => {
        if (this.responseId !== responseId) {
          return;
        }
        // The SDK emits a Buffer (Uint8Array subclass). Using `.buffer` directly
        // can return the *entire* backing ArrayBuffer which may be larger than
        // the actual audio slice. Copy to a correctly-sized ArrayBuffer.
        let audioBuffer: ArrayBuffer | undefined;
        if (data instanceof ArrayBuffer) {
          audioBuffer = data;
        } else if (data instanceof Uint8Array) {
          audioBuffer = data.buffer.byteLength === data.byteLength
            ? data.buffer
            : data.slice().buffer;
        } else if (data && typeof data === 'object' && 'buffer' in data) {
          const d = data as Uint8Array;
          audioBuffer = d.buffer.byteLength === d.byteLength
            ? d.buffer
            : d.slice().buffer;
        }
        if (audioBuffer && audioBuffer.byteLength > 0) {
          this.onAudio(audioBuffer);
        }
      });

      tts.on(LiveTTSEvents.Flushed, () => {
        if (this.onTtsEnd) {
          this.onTtsEnd();
        }
        tts.requestClose?.();
      });

      tts.on(LiveTTSEvents.Error, (error: unknown) => {
        console.error('[DeepgramPipeline] TTS error:', error);
        resolve();
      });

      tts.on(LiveTTSEvents.Close, () => {
        resolve();
      });
    });

    this.isSpeaking = false;
    this.ttsConnection = undefined;
  }
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
