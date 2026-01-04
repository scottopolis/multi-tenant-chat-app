# Clerk Authentication Implementation Spec

## Overview

Add Clerk authentication to the multi-tenant chat assistant dashboard using TanStack Start + Convex integration. This enables real user authentication and replaces the hardcoded `DEV_CLERK_ORG_ID` with actual Clerk organization IDs.

**Effort:** M–L (most of a day including UI wiring and testing)

**Reference Project:** `/Users/sbolinger/Downloads/starter-master` - working Clerk + TanStack Start + Convex implementation.

---

## 1. Package Dependencies

### Dashboard `package.json` - Add Clerk SDK

```jsonc
"dependencies": {
  // ... existing deps ...
  "@clerk/tanstack-react-start": "0.26.5"  // ← add this
}
```

**Important:** Use exact version `0.26.5` to match the working reference project.

### Environment Variables

Create/update `dashboard/.env.local`:

```bash
# Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Convex (existing)
VITE_CONVEX_URL=https://<your-convex-deployment>.convex.cloud
```

---

## 2. Clerk Dashboard Setup

### 2.1 Create JWT Template for Convex

1. Go to Clerk Dashboard → **JWT Templates** → **New template**
2. Choose **Convex** template
3. Template name: `convex`
4. Copy the **Issuer** URL (e.g., `https://<your-app>.clerk.accounts.dev`)

### 2.2 Note Publishable Key

Copy from Clerk Dashboard → **API Keys**:
- Publishable key → `VITE_CLERK_PUBLISHABLE_KEY`
- Secret key → `CLERK_SECRET_KEY`

---

## 3. Convex Backend Changes

### 3.1 Create Auth Config

Create `convex-backend/convex/auth.config.ts`:

```ts
export default {
  providers: [
    {
      domain: process.env.CLERK_FRONTEND_API_URL,
      applicationID: "convex", // must match JWT template name
    },
  ],
};
```

### 3.2 Set Environment Variable in Convex

```bash
cd convex-backend
npx convex env set CLERK_FRONTEND_API_URL "https://<your-app>.clerk.accounts.dev"
npx convex dev  # or npx convex deploy
```

### 3.3 (Optional) Enforce Auth in Convex Functions

For functions that require authentication, add auth checks:

```ts
import { query, mutation } from "./_generated/server";

export const listAgents = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    // Use identity.tokenIdentifier or custom claims as needed
    return await ctx.db.query("agents").collect();
  },
});
```

---

## 4. Dashboard Router Updates

### 4.1 Update `dashboard/src/router.tsx`

Add `convexClient` and `convexQueryClient` to router context:

```tsx
import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routerWithQueryClient } from '@tanstack/react-router-with-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexReactClient } from 'convex/react'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL!
  if (!CONVEX_URL) {
    console.error('missing envar VITE_CONVEX_URL')
  }

  const convexClient = new ConvexReactClient(CONVEX_URL, {
    unsavedChangesWarning: false,
  })
  const convexQueryClient = new ConvexQueryClient(convexClient)

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  })
  convexQueryClient.connect(queryClient)

  const router = routerWithQueryClient(
    createRouter({
      routeTree,
      defaultPreload: 'intent',
      context: {
        queryClient,
        convexClient,       // ← add
        convexQueryClient,  // ← add
      },
      scrollRestoration: true,
      defaultNotFoundComponent: () => (
        <div className="p-8 text-center">
          <h1 className="text-2xl font-bold">404 - Page Not Found</h1>
        </div>
      ),
      // Remove Wrap - providers move to __root.tsx shellComponent
    }),
    queryClient
  )

  return router
}

// Type extension for router context
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
```

---

## 5. Root Layout with Clerk + Convex

### 5.1 Update `dashboard/src/routes/__root.tsx`

```tsx
import { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { createServerFn } from '@tanstack/react-start'

import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { auth } from '@clerk/tanstack-react-start/server'

import { ConvexReactClient } from 'convex/react'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexProviderWithClerk } from 'convex/react-clerk'

import Header from '../components/Header'
import { TenantProvider } from '../lib/tenant'
import appCss from '../styles.css?url'

// Server function to get Clerk auth and Convex token
const fetchClerkAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const { userId, orgId, getToken } = await auth()
  const token = await getToken({ template: 'convex' })

  return { userId, orgId, token }
})

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexClient: ConvexReactClient
  convexQueryClient: ConvexQueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Chat Assistant Dashboard' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  beforeLoad: async (ctx) => {
    const { userId, orgId, token } = await fetchClerkAuth()

    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
    }

    return { userId, orgId, token }
  },
  shellComponent: RootDocument,
  component: () => <Outlet />,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const context = useRouteContext({ from: Route.id })

  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={context.convexClient} useAuth={useAuth}>
        <TenantProvider>
          <html lang="en">
            <head>
              <HeadContent />
            </head>
            <body>
              <Header />
              {children}
              <TanStackDevtools
                config={{ position: 'bottom-right' }}
                plugins={[
                  {
                    name: 'Tanstack Router',
                    render: <TanStackRouterDevtoolsPanel />,
                  },
                ]}
              />
              <Scripts />
            </body>
          </html>
        </TenantProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}
```

---

## 6. Protected Routes Pattern

### 6.1 Create `dashboard/src/routes/_authed.tsx`

Layout route that requires authentication:

```tsx
import { SignIn } from '@clerk/tanstack-react-start'
import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ context }) => {
    if (!context.userId) {
      throw new Error('Not authenticated')
    }
  },
  errorComponent: ({ error }) => {
    if (error.message === 'Not authenticated') {
      const redirectUrl =
        typeof window !== 'undefined' ? window.location.href : undefined
      return (
        <div className="flex items-center justify-center p-12">
          <SignIn routing="hash" forceRedirectUrl={redirectUrl} />
        </div>
      )
    }
    throw error
  },
  component: AppComponent,
})

function AppComponent() {
  return <Outlet />
}
```

### 6.2 Move Dashboard Under Protected Route

Rename `dashboard/src/routes/dashboard.tsx` → `dashboard/src/routes/_authed.dashboard.tsx`:

```tsx
import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { UserButton } from '@clerk/tanstack-react-start'

export const Route = createFileRoute('/_authed/dashboard')({
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <div className="min-h-screen bg-slate-900">
      <nav className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link
                to="/dashboard"
                className="flex items-center px-2 py-2 text-cyan-400 text-lg font-semibold"
              >
                Chat Assistant
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-300 hover:text-white"
                  activeProps={{
                    className:
                      'inline-flex items-center px-1 pt-1 text-sm font-medium text-white border-b-2 border-cyan-500',
                  }}
                >
                  Home
                </Link>
                <Link
                  to="/dashboard/agents"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-300 hover:text-white"
                  activeProps={{
                    className:
                      'inline-flex items-center px-1 pt-1 text-sm font-medium text-white border-b-2 border-cyan-500',
                  }}
                >
                  Agents
                </Link>
              </div>
            </div>
            <div className="flex items-center">
              <UserButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
```

### 6.3 Move Nested Dashboard Routes

Rename all files in `dashboard/src/routes/dashboard/` to `dashboard/src/routes/_authed.dashboard/`:
- `dashboard/index.tsx` → `_authed.dashboard/index.tsx`
- `dashboard/agents.tsx` → `_authed.dashboard/agents.tsx`
- etc.

---

## 7. TenantProvider Updates

### 7.1 Update `dashboard/src/lib/tenant.tsx`

Replace hardcoded `DEV_CLERK_ORG_ID` with real Clerk org:

```tsx
import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from 'convex/react'
import { useAuth } from '@clerk/tanstack-react-start'
import { api } from '../../../convex-backend/convex/_generated/api'

export interface Tenant {
  id: string
  name: string
  clerkOrgId: string
  plan: string
}

interface TenantContextValue {
  tenant: Tenant | null
  isLoading: boolean
}

const TenantContext = createContext<TenantContextValue | null>(null)

export function TenantProvider({ children }: { children: ReactNode }) {
  const { orgId, isLoaded } = useAuth()

  // Skip query if no org selected yet
  const tenant = useQuery(
    api.tenants.getByClerkOrgId,
    orgId ? { clerkOrgId: orgId } : 'skip'
  )

  const value: TenantContextValue = {
    tenant:
      tenant && orgId
        ? {
            id: tenant._id,
            name: tenant.name,
            clerkOrgId: tenant.clerkOrgId,
            plan: tenant.plan,
          }
        : null,
    isLoading: !isLoaded || tenant === undefined,
  }

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  )
}

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}
```

---

## 8. Public Landing Page

### 8.1 Update `dashboard/src/routes/index.tsx`

```tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { SignedIn, SignedOut, SignInButton } from '@clerk/tanstack-react-start'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-white mb-8">
        Multi-Tenant Chat Assistant
      </h1>

      <SignedIn>
        <Link
          to="/dashboard"
          className="px-6 py-3 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600"
        >
          Go to Dashboard
        </Link>
      </SignedIn>

      <SignedOut>
        <SignInButton mode="modal">
          <button className="px-6 py-3 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">
            Sign In
          </button>
        </SignInButton>
      </SignedOut>
    </div>
  )
}
```

---

## 9. Worker/API Changes

**No changes required.** The worker continues using API key authentication for widget and voice requests. Clerk auth is only for the dashboard UI.

---

## 10. Implementation Checklist

### Phase 1: Setup ✅ COMPLETE
- [x] Install `@clerk/tanstack-react-start@0.26.5` in dashboard
- [x] Create Clerk account and application
- [x] Create "convex" JWT template in Clerk Dashboard
- [x] Add env vars to `dashboard/.env.local`
- [x] Create `convex-backend/convex/auth.config.ts`
- [x] Set `CLERK_FRONTEND_API_URL` in Convex environment

**Summary:** Installed Clerk SDK, created auth config for Convex integration, configured environment variables in both dashboard and Convex backend. Also fixed vitest config to exclude e2e tests and pass with no unit tests.

### Phase 2: Router & Root ✅ COMPLETE
- [x] Update `dashboard/src/router.tsx` with convexClient context
- [x] Update `dashboard/src/routes/__root.tsx` with Clerk providers
- [x] Create `dashboard/src/start.ts` with clerkMiddleware()
- [x] Test that app loads without errors

**Summary:** Updated router to pass convexClient and convexQueryClient in context. Added ClerkProvider, ConvexProviderWithClerk, and fetchClerkAuth server function to __root.tsx. Created start.ts with clerkMiddleware for request handling.

### Phase 3: Protected Routes ✅ COMPLETE
- [x] Create `_authed.tsx` layout route
- [x] Move `dashboard.tsx` → `_authed.dashboard.tsx`
- [x] Move nested routes under `_authed.dashboard/`
- [x] Update `index.tsx` as public landing page with SignedIn/SignedOut
- [x] Update Header with UserButton and SignInButton
- [x] Test login flow shows SignIn component
- [x] Create `dashboard/e2e/auth.spec.ts` with 3 passing tests
- [x] Pin TanStack packages to exact versions matching reference project (1.134.x)

**Summary:** Created _authed.tsx layout that checks context.userId and shows Clerk SignIn if not authenticated. Moved all dashboard routes under _authed prefix. Updated Header with UserButton for signed-in users and SignInButton for signed-out users. Updated landing page to show "Go to Dashboard" when signed in or "Sign In to Get Started" when signed out. Fixed package versions to match reference project.

### Phase 4: Tenant Integration
- [ ] Update `TenantProvider` to use Clerk `orgId`
- [ ] Test tenant context loads correctly after login
- [ ] Verify tenant data displays in dashboard

### Phase 5: Polish
- [ ] Handle "no organization selected" state
- [ ] Add sign-out functionality
- [ ] Test full flow: sign in → select org → use dashboard → sign out

---

## 11. Potential Issues & Solutions

### Import Path Variations
The Clerk package may use different import paths. Check the reference project:
- `@clerk/tanstack-react-start` vs `@clerk/tanstack-start`
- Server imports: `@clerk/tanstack-react-start/server`

### No Organization Selected
If users can sign in without an active org, handle this case:
```tsx
if (!orgId) {
  return <SelectOrganizationPage />
}
```

### JWT Template Name Mismatch
Ensure `applicationID` in `auth.config.ts` matches the Clerk JWT template name exactly (`convex`).

### SSR Token Issues
If you see auth errors during SSR, ensure `beforeLoad` is correctly calling `fetchClerkAuth` and setting the token on `convexQueryClient.serverHttpClient`.

---

---

## 12. Widget Changes

### No Clerk Integration Needed

The widget uses **API key authentication** (not Clerk) because:
- Widget is embedded on customer websites for end-user chat
- End users are anonymous visitors, not dashboard users
- Authentication is via `apiKeys` table, validated by the worker

### Current State (from `widget/src/lib/api.ts`)

The widget already has TODO comments for auth header injection:
```ts
// TODO: Authorization: `Bearer ${token}`,
```

### Future Consideration

If you want **authenticated end-user chat** (users sign in before chatting), that would be a separate feature using:
- Clerk's embeddable components for the widget, OR
- A separate auth flow that generates session tokens

**For this Clerk implementation: No widget changes required.**

---

## 13. Unit Tests

### 13.1 TenantProvider Tests

Create `dashboard/src/lib/tenant.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { TenantProvider, useTenant } from './tenant'

// Mock Clerk
vi.mock('@clerk/tanstack-react-start', () => ({
  useAuth: vi.fn(),
}))

// Mock Convex
vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

import { useAuth } from '@clerk/tanstack-react-start'
import { useQuery } from 'convex/react'

describe('TenantProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show loading state while Clerk is loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      orgId: null,
      isLoaded: false,
    } as any)
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { result } = renderHook(() => useTenant(), {
      wrapper: TenantProvider,
    })

    expect(result.current.isLoading).toBe(true)
    expect(result.current.tenant).toBe(null)
  })

  it('should return null tenant when no org is selected', () => {
    vi.mocked(useAuth).mockReturnValue({
      orgId: null,
      isLoaded: true,
    } as any)
    vi.mocked(useQuery).mockReturnValue(undefined)

    const { result } = renderHook(() => useTenant(), {
      wrapper: TenantProvider,
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.tenant).toBe(null)
  })

  it('should return tenant data when org is selected and tenant exists', async () => {
    const mockTenant = {
      _id: 'tenant_123',
      name: 'Acme Corp',
      clerkOrgId: 'org_abc123',
      plan: 'pro',
    }

    vi.mocked(useAuth).mockReturnValue({
      orgId: 'org_abc123',
      isLoaded: true,
    } as any)
    vi.mocked(useQuery).mockReturnValue(mockTenant)

    const { result } = renderHook(() => useTenant(), {
      wrapper: TenantProvider,
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.tenant).toEqual({
      id: 'tenant_123',
      name: 'Acme Corp',
      clerkOrgId: 'org_abc123',
      plan: 'pro',
    })
  })

  it('should throw when useTenant is used outside provider', () => {
    expect(() => {
      renderHook(() => useTenant())
    }).toThrow('useTenant must be used within a TenantProvider')
  })
})
```

### 13.2 Run Unit Tests After Each Phase

```bash
cd dashboard
npm test
```

---

## 14. E2E Tests (Playwright)

### 14.1 Auth Flow Tests

Create `dashboard/e2e/auth.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('should show sign-in button on landing page when not authenticated', async ({ page }) => {
    await page.goto('/')

    // Verify landing page loads
    await expect(page.getByText('Multi-Tenant Chat Assistant')).toBeVisible()

    // Verify sign-in button is visible (not dashboard link)
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('should redirect to sign-in when accessing protected route unauthenticated', async ({ page }) => {
    await page.goto('/dashboard')

    // Should show sign-in component (Clerk modal or inline)
    await expect(page.locator('[data-clerk-component]')).toBeVisible({ timeout: 10000 })
  })

  test('should redirect to sign-in when accessing nested protected route', async ({ page }) => {
    await page.goto('/dashboard/agents')

    // Should show sign-in component
    await expect(page.locator('[data-clerk-component]')).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Authenticated User Flow', () => {
  // These tests require Clerk test mode or mocked auth
  // See: https://clerk.com/docs/testing/playwright

  test.skip('should show dashboard link on landing page when authenticated', async ({ page }) => {
    // TODO: Set up Clerk test user
    await page.goto('/')

    await expect(page.getByRole('link', { name: 'Go to Dashboard' })).toBeVisible()
  })

  test.skip('should display user button in dashboard when authenticated', async ({ page }) => {
    // TODO: Set up Clerk test user
    await page.goto('/dashboard')

    // UserButton should be visible in nav
    await expect(page.locator('.cl-userButton-root')).toBeVisible()
  })

  test.skip('should load tenant data for authenticated user with org', async ({ page }) => {
    // TODO: Set up Clerk test user with organization
    await page.goto('/dashboard')

    // Dashboard should load without errors
    await expect(page.getByText('Welcome to your Dashboard')).toBeVisible()
  })
})
```

### 14.2 Update Existing E2E Tests

Update `dashboard/e2e/agents.spec.ts` to handle auth:

```ts
import { test, expect } from '@playwright/test'

test.describe('Agent Management', () => {
  // Skip tests that require authentication until Clerk test mode is configured
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    // TODO: Add Clerk test authentication setup
    // For now, tests will fail on protected routes
    // See: https://clerk.com/docs/testing/playwright
  })

  test('should navigate from landing page to dashboard', async ({ page }) => {
    await page.goto('/')

    // Verify landing page content
    await expect(page.getByText('Multi-Tenant Chat Assistant')).toBeVisible()

    // When authenticated, should see dashboard link
    // When not authenticated, should see sign-in button
    const dashboardLink = page.getByRole('link', { name: 'Go to Dashboard' })
    const signInButton = page.getByRole('button', { name: /sign in/i })

    // Check which state we're in
    if (await dashboardLink.isVisible()) {
      await dashboardLink.click()
      await expect(page).toHaveURL('/dashboard')
    } else {
      await expect(signInButton).toBeVisible()
    }
  })

  // ... rest of tests remain the same but may need auth setup
})
```

### 14.3 Clerk Playwright Testing Setup

Add to `dashboard/playwright.config.ts`:

```ts
// For Clerk testing, you may need:
// 1. Set CLERK_TESTING=true in env
// 2. Use Clerk's testing tokens
// See: https://clerk.com/docs/testing/playwright

export default defineConfig({
  // ... existing config
  use: {
    // Add Clerk testing header if needed
    extraHTTPHeaders: {
      // 'Authorization': 'Bearer test_token',
    },
  },
})
```

### 14.4 Run E2E Tests

```bash
cd dashboard
npm run test:e2e
```

---

## 15. Updated Implementation Checklist

### Phase 1: Setup ✓ Validate with unit tests
- [ ] Install `@clerk/tanstack-react-start@0.26.5` in dashboard
- [ ] Create Clerk account and application
- [ ] Create "convex" JWT template in Clerk Dashboard
- [ ] Add env vars to `dashboard/.env.local`
- [ ] Create `convex-backend/convex/auth.config.ts`
- [ ] Set `CLERK_FRONTEND_API_URL` in Convex environment
- [ ] **Run `npm test` - should pass (no auth tests yet)**

### Phase 2: Router & Root ✓ Validate app builds
- [ ] Update `dashboard/src/router.tsx` with convexClient context
- [ ] Update `dashboard/src/routes/__root.tsx` with Clerk providers
- [ ] **Run `npm run build` - should compile without errors**
- [ ] **Run `npm run dev` - app should load without crashes**

### Phase 3: Protected Routes ✓ Validate with E2E
- [ ] Create `_authed.tsx` layout route
- [ ] Move `dashboard.tsx` → `_authed.dashboard.tsx`
- [ ] Move nested routes under `_authed.dashboard/`
- [ ] Update `index.tsx` as public landing page
- [ ] Create `dashboard/e2e/auth.spec.ts`
- [ ] **Run `npm run test:e2e` - auth redirect tests should pass**

### Phase 4: Tenant Integration ✓ Validate with unit tests
- [ ] Update `TenantProvider` to use Clerk `orgId`
- [ ] Create `dashboard/src/lib/tenant.test.tsx`
- [ ] **Run `npm test` - tenant provider tests should pass**
- [ ] Test tenant context loads correctly after login (manual)

### Phase 5: Polish ✓ Validate full flow
- [ ] Add UserButton to dashboard nav
- [ ] Handle "no organization selected" state
- [ ] Add sign-out functionality
- [ ] **Run `npm run test:e2e` - all tests should pass**
- [ ] Manual test: sign in → select org → use dashboard → sign out

---

## Reference Files

**Working Example Project:**
- Router: `/Users/sbolinger/Downloads/starter-master/src/router.tsx`
- Root: `/Users/sbolinger/Downloads/starter-master/src/routes/__root.tsx`
- Auth Layout: `/Users/sbolinger/Downloads/starter-master/src/routes/_authed.tsx`
- Dashboard: `/Users/sbolinger/Downloads/starter-master/src/routes/_authed/dashboard.tsx`

**Clerk Testing Docs:**
- https://clerk.com/docs/testing/playwright
- https://clerk.com/docs/testing/test-mode
