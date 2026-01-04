# Clerk Authentication Implementation Spec

## Overview

Add Clerk authentication to the multi-tenant chat assistant dashboard using TanStack Start + Convex integration. This enables real user authentication using personal accounts (one tenant per user).

**Status:** ✅ Implemented

**Reference:** See [docs/authentication.md](../docs/authentication.md) for high-level overview.

---

## Architecture Decision: Personal Accounts

We chose personal accounts over organizations for simplicity:

- **One user = One tenant** (no organization setup required)
- **Auto-provisioning** — tenant created automatically on first login
- **Future-ready** — schema supports `clerkOrgId` for later team features

---

## 1. Package Dependencies

### Dashboard `package.json`

```jsonc
"dependencies": {
  "@clerk/tanstack-react-start": "0.26.5"
}
```

### Environment Variables

`dashboard/.env.local`:

```bash
# Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Convex
VITE_CONVEX_URL=https://<deployment>.convex.cloud
```

---

## 2. Clerk Dashboard Setup

1. **JWT Template**: Create "convex" template, copy Issuer URL
2. **API Keys**: Copy publishable + secret keys to env vars

---

## 3. Convex Backend

### Auth Config

`convex-backend/convex/auth.config.ts`:

```ts
export default {
  providers: [
    {
      domain: process.env.CLERK_FRONTEND_API_URL,
      applicationID: "convex",
    },
  ],
};
```

### Tenant Schema

```ts
tenants: defineTable({
  clerkUserId: v.optional(v.string()),  // Personal accounts
  clerkOrgId: v.optional(v.string()),   // Future team support
  name: v.string(),
  plan: v.string(),
  createdAt: v.number(),
})
  .index("by_clerk_user", ["clerkUserId"])
  .index("by_clerk_org", ["clerkOrgId"])
```

### Tenant Queries

- `getByClerkUserId` — Lookup tenant by user ID (current)
- `getByClerkOrgId` — Lookup by org ID (future)
- `create` — Auto-provision tenant for new users

---

## 4. Dashboard Integration

### TenantProvider

Uses `userId` from Clerk to find/create tenant:

```ts
const { userId, isLoaded } = useAuth()

const tenant = useQuery(
  api.tenants.getByClerkUserId,
  userId ? { clerkUserId: userId } : 'skip'
)
```

### Auto-Provisioning

On first dashboard visit, if no tenant exists:

1. Create tenant with user's name/email
2. Show "Setting up your workspace..." during creation
3. Dashboard loads once tenant is ready

### Protected Routes

- `/_authed.tsx` — Layout that requires authentication
- `/_authed/dashboard/` — All dashboard routes are protected
- Unauthenticated users see Clerk sign-in modal

---

## 5. Implementation Checklist

### Phase 1: Setup ✅
- [x] Install `@clerk/tanstack-react-start@0.26.5`
- [x] Create Clerk application
- [x] Create "convex" JWT template
- [x] Add env vars to `dashboard/.env.local`
- [x] Create `auth.config.ts` in Convex
- [x] Set `CLERK_FRONTEND_API_URL` in Convex

### Phase 2: Router & Root ✅
- [x] Update `router.tsx` with convexClient context
- [x] Update `__root.tsx` with Clerk providers

### Phase 3: Protected Routes ✅
- [x] Create `_authed.tsx` layout
- [x] Move dashboard routes under `_authed.dashboard/`
- [x] Update `index.tsx` as public landing

### Phase 4: Tenant Integration ✅
- [x] Update schema to use `clerkUserId`
- [x] Update `TenantProvider` to use `userId`
- [x] Add auto-provisioning on first login
- [x] Create unit tests

### Phase 5: Polish ✅
- [x] UserButton in header
- [x] Sign-out functionality
- [x] Loading states

---

## 6. Future: Adding Organizations

To enable team collaboration later:

1. Update `TenantProvider` to prefer `orgId` over `userId`:
   ```ts
   const tenantKey = orgId ?? userId
   ```

2. Add `OrganizationSwitcher` component to UI

3. Handle migration of personal → team accounts

See [docs/authentication.md](../docs/authentication.md) for more details.

---

## Key Files

| File | Purpose |
|------|---------|
| `dashboard/src/lib/tenant.tsx` | TenantProvider with auto-provisioning |
| `dashboard/src/routes/__root.tsx` | Clerk + Convex providers |
| `dashboard/src/routes/_authed.tsx` | Auth-required layout |
| `convex-backend/convex/tenants.ts` | Tenant queries/mutations |
| `convex-backend/convex/auth.config.ts` | Clerk JWT validation |
