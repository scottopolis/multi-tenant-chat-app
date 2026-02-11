# Launch Plan (Public Release)

This document is the source of truth for getting the platform to a public launch. It is written so any contributor can pick up a workstream without extra context.

## 1) Product Definition

### Core value
A white-label, embeddable chat + voice agent platform that lets businesses deploy AI assistants on their own sites quickly, with tenant isolation and custom tools.

### Target users (v1)
- Growth/Support teams who want to add chat + phone AI to their site without building infra.
- SaaS founders who need a branded assistant for docs/support.

### Primary success metrics
- Time-to-first-value (TTFV): time from signup to first successful chat on a live site.
- Activation: percent of tenants with at least 1 agent deployed and 1 conversation.
- Reliability: error rate, streaming latency, and call drop rate (voice).

## 2) V1 Scope (Must-Haves)

### Tenant/admin basics
- Create tenant, agents, tools, and API keys in dashboard.
- Set domain allowlist per agent.
- Basic branding (logo, colors) reflected in widget.

### Chat widget
- Embeddable script with safe defaults.
- Reliable streaming chat with conversation history.
- Clear empty states and error recovery.

### Voice
- Configure phone number, voice model, and webhook on a per-agent basis.
- Simple call transcript logging.

### Data + storage
- Persist conversations (Convex) and support retrieval in widget.
- Basic data export (CSV/JSON) for tenants.

### Security + compliance (minimum)
- API key hashing in storage.
- Domain allowlist enforcement.
- Rate limits and abuse protection.
- Privacy policy + terms published.

## 3) Out of Scope (Post-v1)
- Usage-based billing and subscriptions.
- Advanced RBAC and multi-admin teams.
- Multi-agent routing and handoffs.
- Deep analytics and model evals.
- SLA and enterprise compliance (SOC2/HIPAA).

## 4) Workstreams and Deliverables

### A) Product + UX
- Dashboard onboarding flow (create agent -> test -> embed).
- Guided setup checklist with progress state.
- Empty states for no agents, no tools, no conversations.
- Widget UI polish: lighter defaults, better prompt hints, default suggestions.

### B) Platform + Backend
- Persisted conversation history (Convex actions + worker auth).
- Auth middleware for worker -> Convex (shared secret or signed JWT).
- Rate limiting at Cloudflare edge.
- Robust error handling and retry strategy for OpenRouter.

### C) Voice reliability
- Webhook retry + idempotency.
- Better call state handling (hangups, silence, retries).
- Clear logs in dashboard for failed voice calls.

### D) Security + Abuse
- API key rotation in dashboard.
- Audit log for critical admin actions.
- CORS and domain allowlist verification tested with Playwright.

### E) Observability
- Central log routing (worker + dashboard).
- Basic tracing of chat request -> model response -> tools.
- Error reporting for widget and dashboard.

### F) Docs + Support
- “Embed in 5 minutes” guide.
- Troubleshooting section (CORS, API key, missing responses).
- Example agent templates (support, sales, onboarding).

## 5) Launch Phases

### Phase 0: Internal Hardening (1-2 weeks)
- Fix known TODOs (auth placeholders, chat history persistence).
- Add key monitoring and error reporting.
- Draft UX improvements and validate with internal dogfooding.

### Phase 1: Private Beta (2-4 weeks)
- 5-10 tenants with direct support.
- Capture real usage and iterate on onboarding flow.
- Publish minimal docs + FAQ.

### Phase 2: Public Launch
- Open self-serve onboarding.
- Add rate limits + abuse guardrails.
- Marketing page + public docs.

## 6) Go/No-Go Checklist

### Product
- [ ] A brand-new tenant can embed the widget and complete a chat in < 10 minutes.
- [ ] Voice agent configuration works end-to-end with transcripts.
- [ ] Dashboard clearly indicates all required steps.

### Reliability
- [ ] Worker error rate < 1% on normal usage.
- [ ] Widget streaming handles disconnections without losing state.

### Security
- [ ] Domain allowlist enforced on worker and tested.
- [ ] API keys hashed at rest with rotation support.

### Support
- [ ] Troubleshooting docs published.
- [ ] Runbook for outages and incidents.

## 7) Risks and Mitigations

- **Abuse / scraping:** add IP rate limits and token-level caps.
- **Provider downtime:** use OpenRouter fallbacks + retries.
- **Tenant confusion:** improve onboarding checklist and embed validation tools.

## 8) Owners and Status (Fill In)

| Workstream | Owner | Status |
|-----------|-------|--------|
| Product + UX | TBD | Not started |
| Platform + Backend | TBD | Not started |
| Voice reliability | TBD | Not started |
| Security + Abuse | TBD | Not started |
| Observability | TBD | Not started |
| Docs + Support | TBD | Not started |

