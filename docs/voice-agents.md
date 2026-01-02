# Voice Agents

This guide covers how to set up and test voice agents with Twilio integration.

## Overview

Voice agents allow users to interact with your AI assistant via phone calls. The system uses:

- **Twilio** for phone number management and call handling
- **OpenAI Realtime API** for real-time voice conversations
- **Cloudflare Durable Objects** for persistent WebSocket connections

## Prerequisites

- Twilio account with a phone number ([twilio.com](https://www.twilio.com))
- OpenAI API key with Realtime API access
- Worker deployed to Cloudflare (or running locally with ngrok for testing)

## Architecture

```
┌─────────────┐      ┌─────────────────────────────────────────────────────────┐
│   Caller    │      │                   Cloudflare Workers                    │
│  (Phone)    │      │                                                         │
└──────┬──────┘      │  ┌─────────────────┐    ┌─────────────────────────────┐ │
       │             │  │   Main Worker   │    │   VoiceCallSession (DO)     │ │
       │ 1. Call     │  │   (Hono)        │    │   - One per CallSid         │ │
       ▼             │  │                 │    │   - Manages WS lifecycle    │ │
┌─────────────┐      │  │ /twilio/voice   │    │                             │ │
│   Twilio    │──────┼──│ /twilio/media   │────│   Twilio ↔ OpenAI Bridge    │ │
│   (Phone)   │      │  │ /twilio/status  │    │                             │ │
└─────────────┘      │  └─────────────────┘    └─────────────────────────────┘ │
                     └─────────────────────────────────────────────────────────┘
                                                          │
                                                          ▼
                                                ┌─────────────────┐
                                                │ OpenAI Realtime │
                                                │      API        │
                                                └─────────────────┘
```

## Creating a Voice Agent

### 1. Create Agent in Dashboard

1. Navigate to the Dashboard → Agents → Create New Agent
2. Under **Capabilities**, check the **Voice** option (you can also enable Web Chat)
3. Configure voice settings:
   - **Model**: GPT Realtime (default)
   - **Voice**: Choose a voice persona (verse, alloy, echo, etc.)
   - **Locale**: Select the language/region
   - **Barge-in**: Enable to allow callers to interrupt the AI
4. Fill in the agent name and system prompt
5. Click **Create Agent**

### 2. Add Voice Settings to Existing Agent

1. Navigate to Dashboard → Agents → Select your agent
2. Click the **Voice** tab
3. Enable voice and configure settings
4. Click **Save Voice Settings**

## Twilio Setup

### 1. Get a Twilio Phone Number

1. Log in to [Twilio Console](https://console.twilio.com)
2. Go to **Phone Numbers** → **Manage** → **Buy a number**
3. Purchase a number with Voice capability

### 2. Configure Webhook

1. In Twilio Console, go to **Phone Numbers** → **Manage** → **Active numbers**
2. Select your phone number
3. Under **Voice Configuration**, find **"A call comes in"**
4. Set to **Webhook** with **HTTP POST**
5. Enter your webhook URL:
   - Production: `https://your-worker.your-domain.workers.dev/twilio/voice`
   - Local testing: `https://your-ngrok-url.ngrok.io/twilio/voice`

### 3. Add Phone Number in Dashboard

1. In the Dashboard, go to your voice-enabled agent
2. Click the **Voice** tab
3. Under **Phone Numbers**, click **+ Add Phone Number**
4. Enter the phone number in E.164 format (e.g., `+15551234567`)
5. Add an optional description
6. Click **Add Number**

## Local Development Testing

### Using ngrok

Since Twilio needs to reach your local worker, use ngrok to create a public tunnel:

```bash
# Install ngrok if needed
brew install ngrok

# Start your worker
cd worker
npm run dev

# In another terminal, create tunnel to worker port
ngrok http 8787
```

Copy the ngrok HTTPS URL (e.g., `https://abc123.ngrok.io`) and use it for Twilio webhook configuration.

### Environment Variables

Add to `worker/.dev.vars`:

```bash
OPENAI_API_KEY=your-openai-key
TWILIO_AUTH_TOKEN=your-twilio-auth-token  # For webhook signature verification
CONVEX_URL=your-convex-deployment-url
```

## Testing Voice Calls

### Manual Testing

1. Ensure your worker is running and accessible (via ngrok for local)
2. Ensure the phone number is configured in both Twilio and the Dashboard
3. Call the Twilio phone number from any phone
4. You should hear the AI agent respond based on your system prompt

### Debugging Tips

1. **Check Twilio logs**: Twilio Console → Monitor → Logs → Calls
2. **Check worker logs**: `wrangler tail` or local terminal output
3. **Verify webhook**: Twilio Console shows webhook request/response for each call

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "This number is not configured" | Phone number not in `twilioNumbers` table | Add number in Dashboard Voice tab |
| Call connects but no audio | WebSocket connection failing | Check worker logs, verify OpenAI key |
| Webhook 404 | Wrong webhook URL | Verify URL matches your worker deployment |
| Webhook timeout | Worker not responding | Check worker is running, ngrok is active |

## Voice Agent Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| **Model** | OpenAI Realtime model to use | gpt-realtime |
| **Voice** | TTS voice persona | verse |
| **Locale** | Language/region for speech | en-US |
| **Barge-in** | Allow caller to interrupt AI | enabled |

### Available Voices

- `verse` - Balanced, natural
- `alloy` - Neutral, clear
- `echo` - Warm, friendly
- `fable` - Expressive, storytelling
- `onyx` - Deep, authoritative
- `nova` - Bright, energetic
- `shimmer` - Soft, calm

## Production Deployment

### 1. Deploy Worker

```bash
cd worker
npm run deploy
```

### 2. Set Production Secrets

```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put TWILIO_AUTH_TOKEN
wrangler secret put CONVEX_URL
```

### 3. Update Twilio Webhook

Change the webhook URL in Twilio Console to your production worker URL:
```
https://your-worker.your-domain.workers.dev/twilio/voice
```

## Monitoring & Analytics

Voice call records are stored in Convex (`voiceCalls` table) with:

- Call duration
- Start/end timestamps
- Status (in_progress, completed, failed)
- OpenAI token usage (when available)
- Twilio costs (via status callbacks)

View call history in the Dashboard (coming in Phase 4).

## Next Steps

- [API Reference](./api-reference.md) - Voice-related API endpoints
- [Tools & Agents](./tools-agents.md) - Add tools to your voice agent
- [Deployment](./deployment.md) - Production deployment guide
