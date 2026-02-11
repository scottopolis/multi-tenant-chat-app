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
Agent creation uses the “Basic” tab, then expands into:
- Tools & Output
- Integrations (Langfuse)
- Security (domain allowlist)
- Knowledge Base
- Voice
- Embed

The dashboard supports direct deep links via `?tab=` for faster navigation.

### Templates
The Basic tab includes optional templates for sales, support, and onboarding. Templates are meant to speed up early usage and are safe to edit before going live.

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
