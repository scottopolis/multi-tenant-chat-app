# Multi-Tenant Chat Assistant - Project Plan

## Overview

Multi-tenant chat assistant SaaS platform:
- **Widget**: Embeddable React chat component (shadcn/ui, SSE streaming)
- **Worker**: Cloudflare Worker backend (Hono + TanStack AI SDK)
- **Dashboard**: TanStack Start web app for tenant configuration
- **Convex**: Database for tenant configs, chat history, and RAG

See [DATABASE.md](DATABASE.md) for database implementation details.

---

## Architecture Changes (In Progress)

### Migrate from OpenAI/Vercel AI SDK → TanStack AI SDK + OpenRouter

**Why:**
- Provider-agnostic: Switch between models without code changes
- Better type safety with full TypeScript inference
- Built-in agent loop strategies (`maxIterations`, `untilFinishReason`)
- Isomorphic tools: Define once, implement for server/client
- Native TanStack Start integration via `createServerFnTool`

**New Stack:**
```
Widget (React + shadcn/ui)
    ↓ SSE
Worker (Hono + TanStack AI)
    ↓
OpenRouter API (any model: Claude, GPT, Gemini, Llama, etc.)
    ↓
Convex (configs, history, vectors via @convex-dev/rag)
```


---

## Next Up

### 1. TanStack AI SDK Migration

DONE

### 2. Convex RAG Migration

DONE

2.1

- [] update design of dashboard homepage to show a mocked chart of account usage, use this code for reference:

"use client"

import { TrendingUp } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export const description = "A linear area chart"

const chartData = [
  { month: "January", desktop: 186 },
  { month: "February", desktop: 305 },
  { month: "March", desktop: 237 },
  { month: "April", desktop: 73 },
  { month: "May", desktop: 209 },
  { month: "June", desktop: 214 },
]

const chartConfig = {
  desktop: {
    label: "Desktop",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function ChartAreaLinear() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Area Chart - Linear</CardTitle>
        <CardDescription>
          Showing total visitors for the last 6 months
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" hideLabel />}
            />
            <Area
              dataKey="desktop"
              type="linear"
              fill="var(--color-desktop)"
              fillOpacity={0.4}
              stroke="var(--color-desktop)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 leading-none font-medium">
              Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
            </div>
            <div className="text-muted-foreground flex items-center gap-2 leading-none">
              January - June 2024
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  )
}

### 3. Widget UI Refresh (shadcn-style)
- [ ] Install shadcn-chat components or build custom
- [ ] Match chat-sdk.dev aesthetic:
  - Suggestion chips below input
  - Streaming with proper scroll management
  - Loading states and typing indicators
- [ ] Components needed:
  - `ChatContainer` - main layout with sidebar
  - `ChatMessages` - virtualized message list
  - `ChatInput` - textarea with file upload, model select
  - `ChatBubble` - message styling with avatar
  - `SuggestionChips` - quick action buttons

### 5. Conversation History Storage
- [ ] Store conversation history in Convex
- [ ] Load history on chat open
- [ ] Persist across sessions

### 6. Widget Security
- Read specs/widget-security.md

---

## Later Phases

- use open router embedding model for convex RAG document upload, see convex-backend/convex/documents.ts

### Evals (Langfuse)
- [ ] Set up Langfuse integration
- [ ] Create eval datasets
- [ ] Build eval runner

### Future
- Agent handoffs
- Voice agents (Realtime API) - DONE
- Human-in-the-loop approval flows (TanStack AI has built-in support)
- Analytics & billing

---

## Architecture

```
End Users → Widget → Cloudflare Worker → OpenRouter → Any LLM
              ↓           ↓
           shadcn/ui   TanStack AI SDK
                          ↓
                       Convex
                       ├── Tenant configs
                       ├── Chat history
                       └── RAG (@convex-dev/rag)
                              ↑
                         Dashboard (TanStack Start)
```

---

## Package Dependencies

### Remove
- `openai` (agents SDK)
- `ai` (Vercel AI SDK)
- OpenAI VectorStore dependencies

### Add
- `@tanstack/ai` - Core SDK
- `@tanstack/ai-openai` - OpenAI-compatible adapter (for OpenRouter)
- `@tanstack/ai-react` - React hooks (useChat)
- `@convex-dev/rag` - Convex RAG component
- `shadcn-chat` or custom shadcn chat components

---

## Open Questions

- Self-hosted vs cloud Langfuse?
- Which shadcn chat component library? (shadcn-chat, shadcn-chatbot-kit, or custom)

---

*Last updated: January 2025*
