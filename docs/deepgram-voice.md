# Deepgram Voice Pipeline

This document describes how the voice stack is wired when using Deepgram for speech-to-text (STT) and text-to-speech (TTS).

## What Deepgram Covers

- **STT**: Streaming transcription of caller or browser audio.
- **TTS**: Streaming audio synthesis for LLM responses.
- **Billing**: Usage tracked by STT duration and TTS characters.

The LLM layer remains provider-agnostic (OpenRouter or direct OpenAI), and the Worker orchestrates the end-to-end pipeline.

## High-Level Flow

1. **Twilio or browser** streams audio into the Worker (WebSocket).
2. **Worker** forwards audio frames to Deepgram STT (streaming).
3. **STT transcripts** are fed to the LLM for response generation.
4. **LLM output** is sent to Deepgram TTS (streaming).
5. **Synthesized audio** is streamed back to Twilio or the browser.
6. **Barge-in**: If new speech is detected while audio is playing, the Worker cancels the current response and starts a new turn.

## Configuration

Voice agent settings are stored in `voiceAgents` and include:

- `sttProvider`: `deepgram`
- `ttsProvider`: `deepgram`
- `sttModel`: e.g., `nova-3`
- `ttsModel`: e.g., `aura-2-thalia-en`
- `ttsVoice`: optional override (leave blank to use the model default)
- `locale`: `en-US`, `en-GB`, etc.
- `bargeInEnabled`: boolean

These values are editable in the Dashboard Voice tab.

## Environment Variables

Required for the Worker:

- `DEEPGRAM_API_KEY`
- `OPENROUTER_API_KEY` (or `OPENAI_API_KEY` for OpenAI directly)

Optional for Twilio validation:

- `TWILIO_AUTH_TOKEN`

## Usage Tracking

At call end, the Worker records:

- `sttUsageSec`: estimated from audio bytes and sample rate
- `ttsCharacters`: number of characters synthesized

These are stored in `voiceCalls` for analytics and billing.

## Notes

- Twilio Media Streams provide 8kHz μ-law audio. The Worker converts this directly for Deepgram STT and sends TTS audio back in the same format.
- Browser preview uses 24kHz linear16 (PCM16) in/out to preserve higher fidelity.

## TTS Lifecycle

Each LLM response opens a new `speak.live` WebSocket connection:

1. `sendText(text)` + `flush()` queues synthesis.
2. Audio chunks arrive via `LiveTTSEvents.Audio` as raw PCM (no container header).
3. `LiveTTSEvents.Flushed` signals all audio for the flush has been sent.
4. The pipeline calls `requestClose()` to tear down the connection, which fires `LiveTTSEvents.Close` and resolves the turn.

The SDK emits audio as a `Buffer` (a `Uint8Array` subclass). The pipeline copies it via `.slice().buffer` to avoid referencing an oversized backing `ArrayBuffer`.

## Browser Preview Details

- The dashboard sets `binaryType = 'arraybuffer'` on its WebSocket so binary TTS chunks arrive as `ArrayBuffer` (not `Blob`).
- Chunks are scheduled for gapless playback via the Web Audio API (`AudioBufferSourceNode` with `nextPlayTime` tracking).
- Barge-in is disabled for preview to avoid echo loops. The `UtteranceEnd` handler also suppresses stale transcripts while TTS is playing.

## Where to Look in Code

- Pipeline: `worker/src/voice/deepgramPipeline.ts`
- Twilio call session: `worker/src/voice/VoiceCallSession.ts`
- Web voice preview: `worker/src/voice/WebVoiceSession.ts`
- Browser playback: `dashboard/src/components/VoicePreview.tsx`
