# MCP Apps Support (Widget)

This doc captures the current MCP Apps approach in the widget and notes for a future agent to continue the work.

## Current Direction (No Hardcoded URLs)

MCP servers are added dynamically by tenants. The widget should **not** accept any hardcoded MCP URLs.

The rule is:
- If a tool result contains an MCP UI resource, render it.
- If it does not, render nothing.

This keeps the widget simple and avoids leaking infrastructure details into the embed config.

## Recommended Future Direction (No Hardcoded URLs)

There are two clean options for full MCP Apps (resourceUri) support without hardcoded URLs:

### Option A: Include Resource in Tool Result (Preferred for Now)
- MCP tool responses embed the UI resource directly.
- Widget uses `UIResourceRenderer` and does not need to call `resources/read`.
- No MCP server URL or sandbox URL is required in the widget.

### Option B: Worker as MCP UI Proxy (Now Implemented)
- Widget calls `POST /api/mcp/resources/read?agent=...` with `{ uri }`.
- Worker resolves which MCP server to call based on the agent’s MCP server list.
- Widget renders the returned UI resource with `UIResourceRenderer`.

## Current Widget Behavior

The widget supports:
- **Embedded MCP UI resources**: If a tool result includes a UI resource, it renders it.
- **resourceUri via MCP Apps**: If a tool result contains `_meta.ui.resourceUri` or `resourceUri`, it fetches the resource via the worker proxy and renders it.
- **No resource**: It renders nothing for the tool result.

Note: MCP Apps normally advertise `resourceUri` in the tool definition. To make this available to the widget today, the worker injects `_meta.ui.resourceUri` into MCP tool results when the MCP server provides it in `tools/list`.

## Notes For The Next Agent

Open questions:
- Should tool events be returned in `GET /api/chats/:chatId` so MCP UIs persist on reload? (Yes, this is required.)
- Should the worker provide a typed “tool event” stream to the widget (instead of relying on SSE tool events)?

Suggested next steps:
1. Ensure tool events are included in chat history responses so UI persists on reload. (Done for Convex.)
2. Add MCP tools to the TanStack AI path so MCP servers are available for chat (still TODO).

## Summary

No hardcoded MCP URLs. The widget renders UI only when a tool result embeds a UI resource. Persist tool events in history to make UIs survive reloads.
