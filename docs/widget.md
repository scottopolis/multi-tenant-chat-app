# Chat Widget

The chat widget is an embeddable React application that allows your customers to interact with AI agents directly on your website. It runs inside an iframe and communicates with your Cloudflare Worker backend via authenticated API requests.

## How It Works

### Embedding the Widget

Website owners add a single script tag to their HTML. The script tag includes configuration attributes like the agent ID, API key, and visual customization options. When the page loads, the embed script creates a floating launcher button and an iframe that contains the full chat interface.

See [widget/public/embed.js](../widget/public/embed.js) for the embed script implementation.

### Launcher and Iframe Communication

The embed script uses the browser's `postMessage` API to communicate with the chat widget running inside the iframe. This allows the parent page to:

- Initialize the widget with configuration (agent ID, API key, theme color)
- Open and close the chat window
- Receive events from the widget (like close requests)

The iframe approach provides strong isolation—the widget's styles and scripts cannot interfere with the host page, and vice versa.

### Mobile Responsiveness

On mobile devices (viewport width ≤768px), the widget expands to full-screen when opened, providing a native app-like experience. On desktop, it appears as a floating panel in the corner of the screen.

## Security Model

The widget uses a layered security approach since true authentication is impossible in a client-side embed context—any token shipped to the browser can be extracted.

### Three Layers of Protection

1. **Cloudflare Edge** — DDoS protection, WAF rules, bot management, and rate limiting at the edge before requests reach your worker.

2. **Cloudflare Worker** — API key validation, tenant-agent binding verification, domain allowlist checks, and dynamic CORS headers.

3. **Convex Backend** — Tenant isolation on all queries and secure API key storage (hashed, never returned after creation).

### API Key Authentication

Each embedded widget includes an API key that identifies the tenant. The worker validates this key against hashed values stored in Convex, ensures the key belongs to the correct tenant for the requested agent, and checks that the request origin matches the agent's allowed domains list.

See [specs/widget-security.md](../specs/widget-security.md) for the complete security specification.

### Domain Allowlists

Tenants configure which domains are allowed to embed their widget. The worker checks the `Origin` header against this allowlist and only returns proper CORS headers for allowed origins. This prevents unauthorized websites from using your API key.

## Configuration Options

| Attribute | Description |
|-----------|-------------|
| `data-agent-id` | Required. The unique identifier for your AI agent. |
| `data-api-key` | Required. Your widget API key for authentication. |
| `data-color` | Theme color for the launcher button (hex format). |
| `data-position` | Launcher position: `bottom-right` or `bottom-left`. |
| `data-icon` | Launcher icon style: `chat`, `help`, or `message`. |

### Auto-Open

Add `?chat=open` to any page URL to automatically open the widget when the page loads.

## Architecture

```
┌─────────────────────────────────────┐
│  Customer Website                    │
│  └─ embed.js (script tag)           │
│      └─ Creates launcher + iframe   │
└──────────────┬──────────────────────┘
               │ postMessage API
               ↓
┌─────────────────────────────────────┐
│  Widget Iframe                       │
│  └─ React chat application          │
│      └─ TanStack Query + shadcn/ui  │
└──────────────┬──────────────────────┘
               │ HTTPS + SSE streaming
               ↓
┌─────────────────────────────────────┐
│  Cloudflare Worker                   │
│  └─ Auth middleware + chat API      │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│  Convex Backend                      │
│  └─ Agents, tenants, API keys       │
└─────────────────────────────────────┘
```

## Related Documentation

- [Getting Started](./getting-started.md) — Installation and setup
- [API Reference](./api-reference.md) — Backend API endpoints
- [Deployment](./deployment.md) — Deploying to production
