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
  private sttAudioInFlight = false;
  private sttAudioStartAt: number | null = null;
  private sttFirstTranscriptAt: number | null = null;
  private sttUtteranceId = 0;
  private sttActiveUtteranceId: number | null = null;

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
      const now = Date.now();
      if (transcript) {
        if (!this.sttFirstTranscriptAt) {
          this.sttFirstTranscriptAt = now;
          if (this.sttAudioStartAt) {
            console.log(
              `[DeepgramPipeline] STT first transcript latency ms=${now - this.sttAudioStartAt} ` +
                `utteranceId=${this.sttActiveUtteranceId ?? this.sttUtteranceId + 1}`
            );
          }
        }
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

      if (data.is_final) {
        if (this.config.bargeInEnabled && this.isSpeaking) {
          this.interrupt();
        }
        this.lastTranscript = '';
        if (this.sttFirstTranscriptAt) {
          console.log(
            `[DeepgramPipeline] STT final latency ms=${now - this.sttFirstTranscriptAt} ` +
              `utteranceId=${this.sttActiveUtteranceId ?? this.sttUtteranceId + 1} ` +
              `chars=${transcript.length}`
          );
        }
        this.enqueueTranscript(transcript);
        return;
      }

      this.lastTranscript = transcript;
    });

    this.sttConnection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
      const now = Date.now();
      if (this.isSpeaking && !this.config.bargeInEnabled) {
        this.lastTranscript = '';
        return;
      }
      if (this.lastTranscript) {
        if (this.config.bargeInEnabled && this.isSpeaking) {
          this.interrupt();
        }
        if (this.sttFirstTranscriptAt) {
          console.log(
            `[DeepgramPipeline] STT utterance end latency ms=${now - this.sttFirstTranscriptAt} ` +
              `utteranceId=${this.sttActiveUtteranceId ?? this.sttUtteranceId + 1} ` +
              `chars=${this.lastTranscript.length}`
          );
        }
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
    if (!this.sttAudioInFlight) {
      this.sttAudioInFlight = true;
      this.sttAudioStartAt = Date.now();
      this.sttFirstTranscriptAt = null;
      this.sttActiveUtteranceId = this.sttUtteranceId + 1;
    }
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
    if (this.sttActiveUtteranceId) {
      this.sttUtteranceId = this.sttActiveUtteranceId;
    } else {
      this.sttUtteranceId += 1;
    }
    this.queue.push(transcript);
    this.resetSttPerf();
    void this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const transcript = this.queue.shift();
      if (!transcript) continue;

      const currentResponseId = ++this.responseId;
      await this.generateAndSpeakStreaming(transcript, currentResponseId);
    }

    this.processing = false;
  }

  private async generateAndSpeakStreaming(userText: string, responseId: number): Promise<void> {
    const apiKey = this.env.OPENROUTER_API_KEY || this.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[DeepgramPipeline] Missing OPENROUTER_API_KEY or OPENAI_API_KEY for LLM');
      return;
    }
    console.log(`[DeepgramPipeline] Generating response for: ${userText}`);
    const llmStart = Date.now();
    let llmFirstTokenAt: number | null = null;

    const messages = [...this.history, { role: 'user' as const, content: userText }];

    const stream = await runAgentTanStack({
      messages,
      apiKey,
      agentId: this.config.agentId || 'default',
      env: {
        CONVEX_URL: this.env.CONVEX_URL,
      },
    });

    this.isSpeaking = true;
    this.lastTranscript = '';

    const client = this.deepgram(this.env.DEEPGRAM_API_KEY);
    const ttsStart = Date.now();
    let ttsOpenAt: number | null = null;
    let ttsFirstAudioAt: number | null = null;
    let sentCharacters = 0;
    let pendingText = '';
    const queuedText: string[] = [];

    const sendTextChunk = (text: string) => {
      if (!text) return;
      sentCharacters += text.length;
      if (this.ttsConnection?.sendText) {
        this.ttsConnection.sendText(text);
      } else {
        queuedText.push(text);
      }
    };

    const flushPendingText = () => {
      if (!pendingText) return;
      sendTextChunk(pendingText);
      pendingText = '';
    };

    const flushReadyQueue = () => {
      if (!this.ttsConnection?.sendText || queuedText.length === 0) return;
      for (const chunk of queuedText) {
        this.ttsConnection.sendText(chunk);
      }
      queuedText.length = 0;
    };

    const pickChunkBoundary = (text: string): number => {
      if (text.length < 80) return -1;
      const max = Math.min(text.length, 240);
      const window = text.slice(0, max);
      const match = window.match(/[\.\?\!]\s|\n/g);
      if (match && match.length > 0) {
        const idx = window.lastIndexOf(match[match.length - 1]);
        if (idx >= 20) return idx + match[match.length - 1].length;
      }
      return text.length >= 160 ? 160 : -1;
    };

    const ttsPromise = new Promise<void>((resolve) => {
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
        ttsOpenAt = Date.now();
        console.log(
          `[DeepgramPipeline] TTS socket open in ms=${ttsOpenAt - ttsStart} ` +
            `responseId=${responseId}`
        );
        if (this.responseId !== responseId) {
          tts.finish?.();
          return;
        }
        flushReadyQueue();
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
          if (!ttsFirstAudioAt) {
            ttsFirstAudioAt = Date.now();
            const base = ttsOpenAt ?? ttsStart;
            console.log(
              `[DeepgramPipeline] TTS first audio latency ms=${ttsFirstAudioAt - base} ` +
                `responseId=${responseId}`
            );
          }
          this.onAudio(audioBuffer);
        }
      });

      tts.on(LiveTTSEvents.Flushed, () => {
        const now = Date.now();
        const base = ttsOpenAt ?? ttsStart;
        console.log(
          `[DeepgramPipeline] TTS flushed in ms=${now - base} responseId=${responseId}`
        );
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
        console.log(
          `[DeepgramPipeline] TTS done in ms=${Date.now() - ttsStart} ` +
            `responseId=${responseId} chars=${sentCharacters}`
        );
        resolve();
      });
    });

    let content = '';
    let cancelled = false;
    try {
      for await (const chunk of stream) {
        if (this.responseId !== responseId) {
          cancelled = true;
          break;
        }
        if (chunk.type === 'content' && chunk.delta) {
          if (!llmFirstTokenAt) {
            llmFirstTokenAt = Date.now();
            console.log(
              `[DeepgramPipeline] LLM first token latency ms=${llmFirstTokenAt - llmStart} ` +
                `responseId=${responseId}`
            );
          }
          content += chunk.delta;
          pendingText += chunk.delta;
          const boundary = pickChunkBoundary(pendingText);
          if (boundary > 0) {
            sendTextChunk(pendingText.slice(0, boundary));
            pendingText = pendingText.slice(boundary);
          }
        }
      }
    } finally {
      if (cancelled) {
        this.ttsConnection?.requestClose?.();
        this.ttsConnection?.finish?.();
        this.ttsConnection?.close?.();
      }
    }

    if (cancelled) {
      this.isSpeaking = false;
      this.ttsConnection = undefined;
      return;
    }

    if (pendingText) {
      flushPendingText();
    }

    console.log(
      `[DeepgramPipeline] LLM done in ms=${Date.now() - llmStart} ` +
        `responseId=${responseId} chars=${content.length}`
    );

    if (content) {
      this.history.push({ role: 'user', content: userText });
      this.history.push({ role: 'assistant', content });
    }

    this.ttsCharacters += sentCharacters;
    this.ttsConnection?.flush?.();
    await ttsPromise;

    this.isSpeaking = false;
    this.ttsConnection = undefined;
  }

  private resetSttPerf(): void {
    this.sttAudioInFlight = false;
    this.sttAudioStartAt = null;
    this.sttFirstTranscriptAt = null;
    this.sttActiveUtteranceId = null;
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
