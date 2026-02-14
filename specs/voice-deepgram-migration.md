# Voice Pipeline Migration: OpenAI Realtime → Deepgram

## Overview

This spec replaces the current OpenAI Realtime-based voice pipeline with Deepgram-managed speech services while preserving the existing Twilio + Cloudflare Worker + Durable Object architecture. The LLM layer remains provider-agnostic (TanStack AI + OpenRouter or other LLMs). The focus is on a minimal-infra integration that keeps telephony and browser preview UX intact while swapping the speech stack.

## Goals

- Replace OpenAI Realtime audio-in/audio-out with Deepgram STT + Deepgram TTS.
- Keep existing Twilio integration (Media Streams) and browser voice preview features.
- Preserve multi-tenant configuration and billing capture in Convex.
- Maintain barge-in behavior and streaming responses.

## Non-Goals

- Building or self-hosting open-source STT/TTS services.
- Changing the underlying LLM provider strategy.
- Redesigning the dashboard UX.

## Proposed Architecture

### Current (OpenAI Realtime)
Twilio/Web audio ↔ Worker DO ↔ OpenAI Realtime ↔ Worker tools/LLM

### Proposed (Deepgram)
Twilio/Web audio → Worker DO → Deepgram STT (streaming) → Worker LLM/tools → Deepgram TTS (streaming) → Worker DO → Twilio/Web audio

### Key Changes
- Replace `RealtimeSession` with a pipeline that:
  - Streams inbound audio to Deepgram STT WebSocket.
  - Streams partial/final transcripts to the LLM.
  - Streams LLM output to Deepgram TTS WebSocket.
  - Streams synthesized audio back to caller/client.

## Dependencies

- Add Deepgram JavaScript SDK (`@deepgram/sdk`) for STT/TTS and voice agent APIs. Installation details are documented by Deepgram. citeturn1view0

## API Surface Changes

### Worker Routes
- `/twilio/voice` (unchanged): TwiML Webhook
- `/twilio/media` (unchanged): Twilio Media Stream WebSocket
- `/voice/preview` (unchanged): Browser mic preview WebSocket

### New Service Integrations
- Deepgram STT streaming WebSocket
- Deepgram TTS streaming WebSocket

## Data Model Updates (Convex)

### voiceAgents (additions)
- `sttProvider`: `"deepgram"`
- `ttsProvider`: `"deepgram"`
- `sttModel`: string (e.g., `nova-3`)
- `ttsModel`: string (e.g., `aura-2-thalia-en`)
- `ttsVoice`: optional string (voice override if needed)
- `deepgramProjectId`: optional string (if needed for billing/keys)

### voiceCalls (additions)
- `sttUsageSec`: number
- `ttsCharacters`: number
- `deepgramCostUsd`: number (estimated)

## Worker Durable Objects

### VoiceCallSession (Twilio)
- Replace OpenAI Realtime transport with a new `DeepgramVoicePipeline`:
  - `TwilioMediaStream` → Deepgram STT (streaming)
  - Transcript events → LLM streaming
  - LLM tokens → Deepgram TTS (streaming)
  - TTS audio → Twilio Media Stream
- Maintain barge-in:
  - On new user speech start, interrupt TTS output and cancel in-flight LLM response.

### WebVoiceSession (Browser Preview)
- Similar pipeline as `VoiceCallSession`, but input/output is browser WebSocket audio.

## Config and Secrets

### Environment Variables
- `DEEPGRAM_API_KEY` (required)
- `DEEPGRAM_API_URL` (optional override)

## Dashboard Changes

### Agent Voice Tab
- Replace OpenAI voice model dropdown with Deepgram STT/TTS options:
  - STT model input (e.g., `nova-3`, `nova-3-multilingual`)
  - TTS model input (e.g., `aura-2-thalia-en`)
  - Optional TTS voice override
- Keep locale and barge-in toggle.

### Voice Preview
- No UX change; just rewire to the new pipeline.

## Usage Tracking & Billing

### Deepgram Usage
- Capture:
  - STT duration (seconds)
  - TTS characters
- Estimate cost for `voiceCalls` log and tenant billing.

### LLM Usage
- Keep existing token usage capture for LLM billing.

## Security

- Keep Twilio signature verification.
- Validate tenant access for `/voice/preview` token.
- Rate limit concurrent calls per tenant.

## Testing

- Update worker unit tests to mock Deepgram STT/TTS streaming.
- Add integration tests for:
  - Twilio call path with Deepgram STT/TTS
  - Web voice preview path

## Rollout Plan

1. Add Deepgram SDK + configuration.
2. Implement Deepgram pipeline behind a feature flag (per-agent).
3. Enable Deepgram for internal agents first.
4. Gradually migrate existing agents or allow per-agent selection.

## Open Questions

1. Should we support both OpenAI Realtime and Deepgram side-by-side long-term?
2. Do we need per-tenant Deepgram keys (BYO billing) or centralized billing with internal chargeback?
3. Which Deepgram models should be the default for STT/TTS?
