# Widget Security Spec

## Overview

Secure the embeddable chat widget API against unauthorized access, abuse, and DDoS attacks using a layered defense approach combining Cloudflare edge security, tenant API keys, domain allowlists, and rate limiting.

## Security Model

### Honest Assessment

In a client-side embed context, **true authentication is impossible** - any token shipped to the browser can be extracted. Our security model focuses on:

1. **Damage limitation** - Rate limiting, quotas, and scoping
2. **Abuse detection** - Logging, alerting, and revocation
3. **Edge protection** - Cloudflare WAF, bot management, DDoS mitigation
4. **Tenant accountability** - Usage tracking and cost attribution

### What We Protect Against

| Threat | Protection | Effectiveness |
|--------|------------|---------------|
| Random websites using our API | Domain allowlists + CORS | ✅ Strong (browser-enforced) |
| Casual abuse/scraping | Rate limiting | ✅ Strong |
| DDoS attacks | Cloudflare edge protection | ✅ Strong |
| Known bad actors | WAF rules + IP blocking | ✅ Strong |
| Automated bots | Bot management + Turnstile | ⚠️ Moderate |
| Determined attackers with spoofed headers | Rate limiting + revocation | ⚠️ Moderate (damage limited) |
| Key extraction + replay | Revocability + quotas | ⚠️ Moderate (can't prevent, only mitigate) |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Customer Website                                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ <script src=".../embed.js"                                  ││
│  │         data-agent-id="acme-support"                        ││
│  │         data-api-key="pk_live_xxxxx"                        ││
│  │         defer></script>                                     ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare Edge (Layer 1: Edge Security)                        │
│  ├─ DDoS Protection (automatic)                                  │
│  ├─ WAF Rules (block known threats)                              │
│  ├─ Bot Management (challenge suspicious traffic)                │
│  ├─ Rate Limiting Rules (per IP, per path)                       │
│  └─ Turnstile (optional CAPTCHA for high-risk actions)           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Cloudflare Worker (Layer 2: Application Security)              │
│  ├─ API Key Validation (hash → lookup in Convex)                │
│  ├─ Tenant-Agent Binding (key must match agent's tenant)        │
│  ├─ Domain Allowlist Check (Origin header vs config)            │
│  ├─ Dynamic CORS (only allowed origins get headers)             │
│  ├─ Per-Key Rate Limiting (secondary limit)                     │
│  └─ Usage Tracking (for quotas and billing)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Convex Backend (Layer 3: Data Security)                         │
│  ├─ Tenant Isolation (all queries filter by tenantId)           │
│  ├─ API Key Storage (hashed, never returned after creation)     │
│  └─ Audit Logs (track key usage, revocations)                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model Changes

### Agents Table (add fields)

```typescript
// convex/schema.ts - agents table
{
  // ... existing fields
  allowedDomains: v.optional(v.array(v.string())), // ["example.com", "*.example.org"]
}
```

### API Keys Table (existing, verify structure)

```typescript
// convex/schema.ts - apiKeys table
{
  keyHash: v.string(),        // SHA-256 hash of the key
  keyPrefix: v.string(),      // First 8 chars for display (pk_live_xxx...)
  tenantId: v.id("tenants"),  // Owner tenant
  name: v.string(),           // Human-readable name
  scopes: v.array(v.string()), // ["widget:chat"] - limit what key can do
  lastUsedAt: v.optional(v.number()),
  revokedAt: v.optional(v.number()),
  createdAt: v.number(),
}
```

## Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal:** Basic API key validation and domain allowlists

#### 1.1 Data Model Updates
- [x] Add `allowedDomains` field to agents table in Convex schema
- [x] Add migration to set default `allowedDomains: ["*"]` for existing agents
- [x] Verify `apiKeys` table structure supports scopes and revocation

#### 1.2 Dashboard UI
- [ ] Add "Allowed Domains" input to agent settings (comma-separated or tag input)
- [ ] Add "API Keys" section to agent settings
  - [ ] Generate new key (show once, then only prefix)
  - [ ] List existing keys with last used date
  - [ ] Revoke key button
- [ ] Add validation: warn if `allowedDomains` contains `*`

#### 1.3 Widget Updates
- [ ] Read `data-api-key` from script tag in embed.js
- [ ] Pass API key to widget component via props
- [ ] Update `api.ts` to include `Authorization: Bearer <key>` header
- [ ] Update EmbedCode component to include API key in generated snippet

#### 1.4 Worker Auth Middleware
- [x] Create `src/middleware/auth.ts` with key validation logic
- [x] Implement SHA-256 hashing for key lookup
- [x] Add Convex HTTP endpoint for key validation (like we did for agents)
- [x] Validate tenant-agent binding (key's tenant must own the agent)
- [x] Check Origin header against `allowedDomains`
- [x] Return 401/403 with clear error messages

#### 1.5 Dynamic CORS
- [ ] Replace `cors({ origin: '*' })` with dynamic CORS middleware
- [ ] Only return `Access-Control-Allow-Origin` for allowed domains
- [ ] Handle preflight (OPTIONS) requests correctly

---

### Phase 2: Edge Security (Week 2)

**Goal:** Cloudflare-level protection against DDoS and bots

#### 2.1 Cloudflare WAF Rules
- [ ] Enable managed rulesets (OWASP Core Ruleset)
- [ ] Create custom rules:
  - Block requests with empty User-Agent to `/api/*`
  - Block known bad ASNs (hosting providers commonly used for abuse)
  - Challenge requests from TOR exit nodes

#### 2.2 Rate Limiting at Edge
- [ ] Create rate limiting rule: 100 req/min per IP to `/api/chats/*/messages`
- [ ] Create rate limiting rule: 20 req/min per IP to `/api/chats` (create)
- [ ] Configure action: Challenge (429) → Block after repeated violations

#### 2.3 Bot Management (if on Pro+ plan)
- [ ] Enable Bot Fight Mode
- [ ] Configure Super Bot Fight Mode rules
- [ ] Set up JavaScript detection for widget requests

#### 2.4 Monitoring & Alerting
- [ ] Set up Cloudflare analytics dashboard
- [ ] Create alert for unusual traffic spikes
- [ ] Create alert for high rate limit trigger counts

---

### Phase 3: Advanced Protection (Week 3)

**Goal:** Turnstile integration and usage quotas

#### 3.1 Cloudflare Turnstile Integration
- [ ] Create Turnstile widget in Cloudflare dashboard
- [ ] Add Turnstile to widget UI (invisible mode, triggers on chat create)
- [ ] Create worker endpoint to verify Turnstile token
- [ ] Require valid Turnstile token for `/api/chats` POST

#### 3.2 Usage Quotas
- [ ] Track message count per tenant per day in Convex
- [ ] Add `monthlyMessageLimit` to tenant/plan config
- [ ] Return 429 when quota exceeded
- [ ] Add usage dashboard in admin panel

#### 3.3 Abuse Detection
- [ ] Log suspicious patterns:
  - High error rates from single IP/key
  - Requests with mismatched Origin/Referer
  - Unusual message patterns (very short, repetitive)
- [ ] Create abuse scoring system
- [ ] Auto-revoke keys exceeding abuse threshold

---

### Phase 4: Hardening (Week 4)

**Goal:** Production hardening and documentation

#### 4.1 Security Audit
- [ ] Review all endpoints for tenant isolation
- [ ] Verify no API key or secret leakage in responses
- [ ] Test cross-tenant access attempts
- [ ] Penetration testing for common attack vectors

#### 4.2 Key Rotation Support
- [ ] Add key expiration dates (optional)
- [ ] Dashboard UI for key rotation workflow
- [ ] Grace period for old keys during rotation

#### 4.3 Documentation
- [ ] Update README with security model
- [ ] Create security best practices guide for tenants
- [ ] Document incident response for key compromise

#### 4.4 Tenant Security Controls
- [ ] Per-tenant IP allowlist (optional, for enterprise)
- [ ] Webhook notifications for security events
- [ ] Export audit logs

---

## Embed Code (Final)

```html
<script
  src="https://multi-tenant-chat-app.pages.dev/embed.js"
  data-agent-id="acme-support"
  data-api-key="pk_live_a1b2c3d4e5f6"
  data-color="#4F46E5"
  data-position="bottom-right"
  defer
></script>
```

## API Key Lifecycle

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Create    │ ──→ │   Active    │ ──→ │  Revoked    │
│  (Dashboard)│     │  (In Use)   │     │ (Blocked)   │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       ↓                   ↓                   ↓
  Show full key       Track usage         Return 401
  (once only)         Last used date      Log attempt
```

## Worker Auth Flow (Pseudocode)

```typescript
// middleware/auth.ts
export async function authMiddleware(c: Context, next: Next) {
  // 1. Extract credentials
  const authHeader = c.req.header('Authorization');
  const agentId = c.req.query('agent');
  const origin = c.req.header('Origin') || '';

  // 2. Validate API key
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing API key' }, 401);
  }
  
  const apiKey = authHeader.slice(7);
  const keyHash = await sha256(apiKey);
  
  const keyInfo = await validateKeyWithConvex(keyHash, c.env.CONVEX_URL);
  if (!keyInfo || keyInfo.revokedAt) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  // 3. Load agent config
  const agent = await getAgentConfig(agentId, c.env);
  if (agent.tenantId !== keyInfo.tenantId) {
    return c.json({ error: 'Key not authorized for this agent' }, 403);
  }

  // 4. Check domain allowlist
  const originHost = new URL(origin).hostname;
  if (!isHostAllowed(originHost, agent.allowedDomains)) {
    return c.json({ error: 'Origin not allowed' }, 403);
  }

  // 5. Set context and continue
  c.set('tenantId', keyInfo.tenantId);
  c.set('agentId', agentId);
  c.set('apiKeyId', keyInfo.id);
  
  // 6. Set CORS headers for allowed origin
  c.header('Access-Control-Allow-Origin', origin);
  c.header('Vary', 'Origin');

  await next();
}
```

## Cloudflare Configuration

### wrangler.toml additions

```toml
# Rate limiting (requires paid plan for custom rules)
# Configure via Cloudflare dashboard instead

[vars]
# No secrets here - use wrangler secret put
```

### Recommended WAF Rules (via Dashboard)

| Rule Name | Expression | Action |
|-----------|------------|--------|
| Block empty UA | `http.request.uri.path contains "/api/" and len(http.user_agent) eq 0` | Block |
| Rate limit messages | `http.request.uri.path contains "/messages" and http.request.method eq "POST"` | Rate limit (100/min) |
| Rate limit chat create | `http.request.uri.path eq "/api/chats" and http.request.method eq "POST"` | Rate limit (20/min) |
| Challenge suspicious | `cf.threat_score gt 30` | Challenge |

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Unauthorized request block rate | >99% | Cloudflare analytics |
| False positive rate | <0.1% | Customer complaints |
| DDoS mitigation | 100% uptime | Monitoring |
| Key revocation time | <5 min | Dashboard → API blocked |
| Abuse detection latency | <1 hour | Alert to action |

## References

- [Cloudflare WAF Documentation](https://developers.cloudflare.com/waf/)
- [Cloudflare Rate Limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)
- [OWASP API Security Top 10](https://owasp.org/API-Security/)
