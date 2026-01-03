# Widget Embed & Hosting Spec

## Overview

Host the React widget on **Cloudflare Pages** and provide tenant-specific embed codes using the existing `?agent=` URL parameter for routing.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Customer Website                                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ <script src="multi-tenant-chat-app.pages.dev/embed.js"           ││
│  │         data-agent-id="tenant-abc" defer></script>     ││
│  └─────────────────────────────────────────────────────────┘│
│                          ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Injected iframe:                                        ││
│  │ src="multi-tenant-chat-app.pages.dev/?agent=tenant-abc"          ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓ API calls
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Worker (existing)                                │
│  multi-tenant-chat-app.designbyscott.workers.dev             │
│  - Routes requests by ?agent= param                          │
│  - Tenant isolation enforced server-side                     │
└─────────────────────────────────────────────────────────────┘
```

## Hosting Strategy

### Why Cloudflare Pages (not Workers)

- Widget is a pure static React bundle
- Pages is simpler and optimized for static assets
- Keep API on Workers, widget on Pages (separation of concerns)
- Free tier includes unlimited requests

### Deployment

1. **Build command:** `npm run build`
2. **Build output:** `dist`
3. **Environment variable:** `VITE_API_URL=https://multi-tenant-chat-app.designbyscott.workers.dev`
4. **Result URL:** `https://multi-tenant-chat-app.pages.dev`

## Embed Code Options

### Option 1: Script Tag (Recommended)

Dashboard generates this snippet for each tenant:

```html
<script
  src="https://multi-tenant-chat-app.pages.dev/embed.js"
  data-agent-id="TENANT_AGENT_ID"
  defer
></script>
```

The `embed.js` script:
- Reads `data-agent-id` from the script tag
- Creates and injects an iframe with fixed positioning
- No configuration needed by the customer

### Option 2: Iframe (Direct)

For customers who prefer full control:

```html
<iframe
  src="https://multi-tenant-chat-app.pages.dev/?agent=TENANT_AGENT_ID"
  style="border: none; position: fixed; bottom: 24px; right: 24px; 
         width: 360px; height: 520px; z-index: 2147483647; 
         border-radius: 16px; overflow: hidden;"
></iframe>
```

## Widget Requirements

Ensure the widget reads `agent` from URL params:

```ts
const urlParams = new URLSearchParams(window.location.search);
const agentId = urlParams.get("agent") || import.meta.env.VITE_AGENT_ID || "default";
```

## Security Considerations

### Without Authentication

| Risk | Mitigation |
|------|------------|
| Agent ID is public | Treat as identifier, not secret. Store sensitive config server-side. |
| Anyone can embed widget | Accept for MVP. Add origin allowlist later if needed. |
| Abuse/spam | Add per-IP + per-agent rate limiting on Worker |
| Cross-tenant data leakage | Enforce isolation in Worker queries (scope by agent) |

### Iframe Benefits

- Isolates widget CSS/JS from host page
- Prevents XSS attacks in either direction
- Standard browser security model

### CORS

Configure Worker to allow requests from `multi-tenant-chat-app.pages.dev` origin.

## Implementation Tasks

1. [x] Add `embed.js` to `widget/public/` - ✅ Implemented with launcher button, iframe injection, postMessage protocol
2. [x] Verify widget reads `?agent=` param correctly - ✅ Updated AgentContext with URL param priority
3. [x] Create `.env.production` with `VITE_API_URL` - ✅ Created .env.production and .env.example
4. [x] Set up Cloudflare Pages project - ✅ Deployed at https://multi-tenant-chat-app.pages.dev
5. [x] Configure CORS on Worker for Pages origin - ✅ Worker uses `origin: '*'` (acceptable for MVP)
6. [x] Add embed code generator to dashboard - ✅ Implemented EmbedCode component with customization options
7. [ ] Add rate limiting (future)

---

## Launcher & Iframe Architecture

### Overview

Intercom-style widget with:
- **Launcher button** in parent DOM (controlled by `embed.js`)
- **Chat UI** inside iframe for isolation
- **postMessage** communication between parent and iframe

```
┌─────────────────────────────────────────────────────────────┐
│  Customer Website (parent)                                   │
│                                                              │
│  embed.js controls:                                          │
│  ┌──────────────────┐                                        │
│  │ Launcher Button  │  ← Click toggles open/closed           │
│  └──────────────────┘                                        │
│           ↕ postMessage                                      │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ <iframe src="widget.pages.dev/?agent=xyz">              ││
│  │   React Chat UI                                          ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Embed Code with Customization

```html
<script
  src="https://multi-tenant-chat-app.pages.dev/embed.js"
  data-agent-id="TENANT_AGENT_ID"
  data-color="#4F46E5"
  data-position="bottom-right"
  data-icon="chat"
  defer
></script>
```

| Attribute | Default | Options |
|-----------|---------|---------|
| `data-agent-id` | required | Tenant identifier |
| `data-color` | `#4F46E5` | Any hex color |
| `data-position` | `bottom-right` | `bottom-right`, `bottom-left` |
| `data-icon` | `chat` | `chat`, `help`, `message` |

### Auto-Open via URL Parameter

Widget can auto-open if the host page URL contains `?chat=open`:

```
https://customer-site.com/support?chat=open
```

`embed.js` checks for this on load and opens immediately.

### State Management

**Open/Closed only** (no minimize state):
- `isOpen = false`: iframe hidden, launcher visible
- `isOpen = true`: iframe visible, launcher visible (or hidden on mobile)

**Parent is source of truth** for visibility. Iframe can request close via postMessage.

### postMessage Protocol

All messages use namespace `mychat-widget` with version for future compatibility:

```ts
type WidgetMessage = {
  source: 'mychat-widget';
  version: 1;
  type: 'INIT' | 'OPEN' | 'CLOSE' | 'WIDGET_READY' | 'REQUEST_CLOSE';
  payload?: any;
};
```

#### Parent → Iframe

| Message | When | Payload |
|---------|------|---------|
| `INIT` | After iframe loads | `{ agentId, color, locale }` |
| `OPEN` | User clicks launcher | - |
| `CLOSE` | User clicks launcher again | - |

#### Iframe → Parent

| Message | When | Payload |
|---------|------|---------|
| `WIDGET_READY` | React app mounted | - |
| `REQUEST_CLOSE` | User clicks X in chat header | - |

### Security

**Parent (embed.js):**
```js
const WIDGET_ORIGIN = 'https://multi-tenant-chat-app.pages.dev';
window.addEventListener('message', (event) => {
  if (event.origin !== WIDGET_ORIGIN) return;
  // process message
});
iframe.contentWindow.postMessage(msg, WIDGET_ORIGIN);
```

**Iframe (React):**
```js
let parentOrigin = null;
window.addEventListener('message', (event) => {
  if (msg.type === 'INIT') parentOrigin = event.origin;
  if (event.origin !== parentOrigin) return;
  // process message
});
window.parent.postMessage(msg, parentOrigin);
```

### Mobile Responsiveness

| Viewport | Launcher | Chat Panel |
|----------|----------|------------|
| Desktop (>768px) | Fixed corner button | 360×520px panel |
| Mobile (≤768px) | Fixed corner button | Fullscreen overlay |

---

## Future Enhancements

- Unread message badge on launcher
- Origin allowlist per tenant
- JS SDK for advanced integrations
- Per-user authentication in widget
- Sound notifications
