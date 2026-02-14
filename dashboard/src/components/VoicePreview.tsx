import { useState, useRef, useCallback } from "react";
import type { Id } from "../../../convex-backend/convex/_generated/dataModel";
import { useTenant } from "../lib/tenant";
import { getWorkerHost, toWebSocketUrl } from "../lib/workerHost";

interface VoicePreviewProps {
  agentDbId: Id<"agents">;
}

const SAMPLE_RATE = 24000;

function float32ToPcm16(float32Array: Float32Array): Int16Array {
  const pcm16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16;
}

function pcm16ToFloat32(pcm16: Int16Array): Float32Array {
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    float32[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7fff);
  }
  return float32;
}

export function VoicePreview({ agentDbId }: VoicePreviewProps) {
  const { tenant } = useTenant();
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const outputGainRef = useRef<GainNode | null>(null);

  const getPreviewToken = async (): Promise<string> => {
    const workerHost = getWorkerHost();
    if (!workerHost) {
      throw new Error("Worker URL not available");
    }
    const response = await fetch(`${workerHost}/voice/preview/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentDbId: agentDbId,
        tenantId: tenant?.id,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to get preview token");
    }

    const data = await response.json();
    return data.token;
  };

  const stopAllPlayback = useCallback(() => {
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Already stopped
      }
    }
    activeSourcesRef.current.clear();
    nextPlayTimeRef.current = 0;
  }, []);

  const playAudioData = useCallback((pcmData: ArrayBuffer) => {
    if (!audioContextRef.current) return;
    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch((err) => {
        console.warn("[VoicePreview] Failed to resume AudioContext:", err);
      });
    }

    const int16Array = new Int16Array(pcmData);
    const float32Array = pcm16ToFloat32(int16Array);

    const audioBuffer = audioContextRef.current.createBuffer(
      1,
      float32Array.length,
      SAMPLE_RATE,
    );
    audioBuffer.copyToChannel(float32Array, 0);

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    const gain = outputGainRef.current;
    if (gain) {
      source.connect(gain);
    } else {
      source.connect(audioContextRef.current.destination);
    }

    activeSourcesRef.current.add(source);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
    };

    const currentTime = audioContextRef.current.currentTime;
    const startTime = Math.max(currentTime, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + audioBuffer.duration;
  }, []);

  const startPreview = async () => {
    if (!tenant) {
      setError("Tenant not loaded");
      return;
    }

    if (wsRef.current || isConnecting) {
      return;
    }

    setIsConnecting(true);
    setError(null);
    nextPlayTimeRef.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      mediaStreamRef.current = stream;

      audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
      if (audioContextRef.current.state === "suspended") {
        await audioContextRef.current.resume();
      }
      const source = audioContextRef.current.createMediaStreamSource(stream);
      outputGainRef.current = audioContextRef.current.createGain();
      outputGainRef.current.gain.value = 2.0;
      outputGainRef.current.connect(audioContextRef.current.destination);

      const processor = audioContextRef.current.createScriptProcessor(
        4096,
        1,
        1,
      );

      const token = await getPreviewToken();
      const workerHost = getWorkerHost();
      if (!workerHost) {
        throw new Error("Worker URL not available");
      }
      const wsBase = toWebSocketUrl(workerHost);
      const wsUrl = `${wsBase}/voice/preview?agentDbId=${agentDbId}&tenantId=${tenant.id}&token=${encodeURIComponent(token)}`;

      wsRef.current = new WebSocket(wsUrl);
      wsRef.current.binaryType = "arraybuffer";

      wsRef.current.onopen = () => {
        setIsActive(true);
        setIsConnecting(false);
      };

      wsRef.current.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          playAudioData(event.data);
        } else if (typeof event.data === "string") {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "interrupt") {
              stopAllPlayback();
            }
          } catch {
            // Not JSON, ignore
          }
        }
      };

      wsRef.current.onerror = (event) => {
        setError("Connection error");
        stopPreview();
      };

      wsRef.current.onclose = (event) => {
        if (isActive) {
          stopPreview();
        }
      };

      processor.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = float32ToPcm16(inputData);
          wsRef.current.send(pcm16.buffer);
        }
      };

      source.connect(processor);
      const silentGain = audioContextRef.current.createGain();
      silentGain.gain.value = 0;
      silentGain.connect(audioContextRef.current.destination);
      processor.connect(silentGain);
    } catch (err) {
      console.error("[VoicePreview] Error starting preview:", err);
      setError(err instanceof Error ? err.message : "Failed to start preview");
      setIsConnecting(false);
      stopPreview();
    }
  };

  const stopPreview = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (outputGainRef.current) {
      outputGainRef.current.disconnect();
      outputGainRef.current = null;
    }

    setIsActive(false);
    setIsConnecting(false);
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-medium text-gray-900">Preview</h4>
      <p className="text-sm text-gray-500">
        Test your voice agent directly in the browser. No phone number required.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={isActive ? stopPreview : startPreview}
          disabled={isConnecting}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
            isActive
              ? "bg-red-600 hover:bg-red-500"
              : isConnecting
                ? "bg-gray-400 cursor-wait"
                : "bg-gray-900 hover:bg-gray-800"
          } disabled:opacity-50`}
        >
          {isActive ? (
            <>
              <MicOffIcon />
              End Preview
            </>
          ) : isConnecting ? (
            <>
              <LoadingIcon />
              Connecting...
            </>
          ) : (
            <>
              <MicIcon />
              Preview Voice
            </>
          )}
        </button>

        {isActive && (
          <span className="flex items-center gap-2 text-sm text-green-600">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Listening...
          </span>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Uses your microphone. Sessions auto-disconnect after 10 minutes.
      </p>
    </div>
  );
}

function MicIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
        clipRule="evenodd"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
      />
    </svg>
  );
}

function LoadingIcon() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
