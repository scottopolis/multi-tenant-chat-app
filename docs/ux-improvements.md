# UX Improvements Plan

This document lists UX issues and improvements discovered from code review and documentation. It is written to be actionable and testable.

## 1) Current UX Observations (from code/docs)

### Widget
- Chat auto-creates a conversation, but the loading state is opaque (no progress or context).
- Sidebar chat list has a hidden delete action and no grouping or search.
- Empty states are minimal and do not guide users to next steps.
- No obvious onboarding or model/agent context is shown in the chat UI.

### Dashboard
- Dashboard UX appears unfinished (see PLAN.md notes and TODOs).
- Agent setup steps are not clearly sequenced (prompt, tools, voice, embed).

### Voice
- Voice flows are described in docs but lack UX surfaces for status, retries, or transcript visibility.

## 2) Goals for UX

- Reduce time-to-first-value to < 10 minutes.
- Make configuration and embedding feel “guided,” not manual.
- Provide clear feedback on errors, missing configuration, and required steps.

## 3) Recommended UX Changes (Prioritized)

### P0: Onboarding + First Run
- Add a guided setup checklist in the dashboard:
  1) Create agent
  2) Add system prompt
  3) Configure tools (optional)
  4) Generate API key
  5) Add domain allowlist
  6) Install embed script
  7) Test chat
- Provide an embed script “copy” and validation button (pings worker).

### P0: Widget usability
- Add better empty states (welcome message, suggested prompts, what the agent can do).
- Show agent name and avatar in header.
- Improve error UX (retry, reconnect, “Try again” CTA).

### P1: Chat list
- Add recent conversations with search and tag/label support.
- Add “New chat” as a primary CTA.

### P1: Voice experience
- Add a status panel for voice configuration with test call.
- Add transcript + call logs with timestamps.

### P2: Multi-tenant polish
- Brand customization preview for widget (colors, logo, tone).
- Add templated agent starters (support, sales, FAQ).

## 4) UX Experiments

- **Experiment A:** onboarding checklist vs. free-form setup.
- **Experiment B:** suggested prompts vs. blank input state.
- **Experiment C:** embed validation checker vs. docs-only.

## 5) Validation Metrics

- Activation rate (tenant -> agent -> embed -> first chat).
- Completion rate of onboarding checklist.
- Support tickets per 100 tenants.
- Widget conversion (open -> message sent).

## 6) Next Steps

- Map all current dashboard screens to the checklist and identify gaps.
- Create 2-3 sample onboarding scripts for common use cases.
- Add a short in-app tutorial for embedding.

