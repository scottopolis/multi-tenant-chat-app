# Dashboard UX Guide

This guide describes the current dashboard UX strategy for invite-only onboarding, with a focus on medium-size businesses using AI for sales/support.

## UX Principles
- **Guided onboarding:** every screen should answer “what do I do next?”
- **Fast time-to-first-value:** create agent, generate key, embed widget, test chat.
- **Confidence for business users:** clear guardrails (domain allowlist, API key handling).
- **Invite-only readiness:** operational reminders and manual validation steps.

## Primary Flow (Invite-Only Beta)
1) Create agent.
2) Add system prompt with sales/support tone and policy guidance.
3) Generate API key.
4) Set domain allowlist.
5) Embed widget and test chat.
6) Invite customer and monitor first conversations.

## Dashboard Home (Launch Checklist)
The home page surfaces an onboarding checklist with real-time status from Convex:
- Agent created
- System prompt configured
- API key generated
- Domain allowlist set
- Widget embed installed (manual)

The checklist provides direct links into the correct agent tabs.

## Agent Setup UX
Agent configuration uses a single-page, sectioned layout with progressive disclosure:
- Agent basics (name, system prompt)
- Model and tools
- Knowledge base, voice, and embed settings
- Advanced settings at the bottom for security and integrations

The dashboard supports direct deep links via `?tab=` by scrolling to the relevant section.


## Suggested Enhancements (Next Iteration)
- Agent templates (sales/support/onboarding) to prefill system prompts.
- “Preview widget” modal with staging host validation.
- Guided embed wizard with copy + verification.
- Usage insights in agent list (recent conversations, last activity).

## Operational Checklist (Before Inviting Customers)
- Confirm at least one agent has a production-ready system prompt.
- API key is created and stored securely.
- Domain allowlist is restricted to customer sites.
- Test a full chat flow and confirm logs appear in Conversations.
