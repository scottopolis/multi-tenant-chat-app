# Authentication & Access Control

This document is the source of truth for how authentication and authorization work today, and what is still missing.

## Current State (Implemented Today)

### Dashboard (Clerk UI)
- The dashboard uses Clerk for sign-in/sign-up UI.
- Routes under `/_authed/*` require a Clerk session and show the Clerk SignIn component when unauthenticated.
- The dashboard fetches a Clerk JWT (`template: "convex"`) and passes it to Convex via `ConvexProviderWithClerk`.

**Important:** Tenant-scoped Convex queries/mutations now enforce Clerk identity and tenant ownership. If a function takes `tenantId`, it validates that the signed-in user owns that tenant.

### Widget + Worker API
- The worker now enforces API key + domain allowlist checks for `/api/*` routes by default.
- Local bypass is available via `AUTH_MODE=permissive` in `worker/.dev.vars`.
- The widget sends an API key via `Authorization: Bearer <apiKey>` when configured.
- CORS is set after origin validation in auth middleware; in permissive mode it is effectively open.

### Convex HTTP Endpoints
The worker calls Convex HTTP actions and **must** authenticate with a shared secret:
- `POST /api/keys/validate`
- `POST /api/keys/touch`
- `GET /api/agents/:agentId`

Set the secret in both environments:
- Worker: `CONVEX_HTTP_SECRET`
- Convex: `CONVEX_HTTP_SECRET`

## Building Blocks That Exist

- API key hashing and validation in Convex: `convex-backend/convex/apiKeys.ts` and `convex-backend/convex/http.ts`.
- Worker auth middleware that can enforce:
  - API key validity
  - tenant-agent binding
  - domain allowlists
  - CORS for validated origins

## What Is Still Required (To Finish Auth)

1. **Extend enforcement to any new dashboard functions** as they’re added.
2. **Add Org/Team support** (Clerk Organizations) if/when you want shared workspaces.

## Remaining Security Considerations

- **Convex query/mutation HTTP endpoints are not authenticated**. The worker currently calls them directly using `CONVEX_URL`. This is acceptable as long as that URL isn’t exposed and all public traffic goes through the worker, but it is still a potential risk if the URL leaks. If you want to harden this, consider:
  - Restricting access to Convex deployments where possible, and
  - Moving any sensitive operations to protected HTTP actions that verify a shared secret.

## Future: Team/Organization Support (Optional)

Clerk Organizations can replace the current “one user = one tenant” model. The schema already includes `clerkOrgId` on tenants, so the change is mostly in tenant resolution and UI (org switcher). This is not implemented yet.
