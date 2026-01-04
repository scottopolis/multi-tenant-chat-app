# Authentication

## Overview

This application uses [Clerk](https://clerk.com) for authentication. Clerk handles user sign-up, sign-in, session management, and identity verification.

## Current Setup: Personal Accounts

Each user gets their own workspace (tenant) automatically when they first sign in. This is the simplest model:

- **One user = One tenant**
- No team collaboration features
- No organization management overhead
- Instant onboarding — users can start using the dashboard immediately after sign-in

### How It Works

1. User signs up or signs in via Clerk
2. On first dashboard visit, a tenant is automatically created for them
3. All their agents, API keys, and data are scoped to their personal tenant
4. The user's Clerk user ID links to their tenant record

### User Experience

- Landing page shows "Sign In" button for unauthenticated visitors
- After sign-in, users are redirected to the dashboard
- User avatar appears in the header with account management options
- Sign-out returns to the landing page

## Security

- Authentication is handled entirely by Clerk (no passwords stored in our database)
- Convex backend validates Clerk JWT tokens for API calls
- All data queries are scoped by tenant ID to prevent cross-user data access

---

## Future: Adding Team/Organization Support

Clerk supports "Organizations" which allow multiple users to collaborate under a shared workspace. This is useful for:

- Agencies managing multiple client chatbots
- Teams collaborating on agent development
- Enterprise accounts with role-based access control

### What Would Change

| Current (Personal) | Future (Organizations) |
|-------------------|----------------------|
| User ID → Tenant | Organization ID → Tenant |
| One workspace per user | One workspace per org |
| No collaboration | Team members share access |
| Free Clerk tier | Requires Clerk paid plan |

### Migration Path

The infrastructure is already prepared for this upgrade:

1. **Database schema** already has an optional `clerkOrgId` field on tenants
2. **TenantProvider** can be updated to prefer `orgId` over `userId`
3. **OrganizationSwitcher** component can be added for users to switch between personal and team workspaces

### When to Consider Organizations

- Users request team collaboration features
- You need role-based permissions (admin, member, viewer)
- Enterprise customers require SSO or domain-based access
- You want to charge per-organization rather than per-user

### Clerk Pricing Note

Organizations are available on Clerk's Pro plan and above. Review [Clerk's pricing](https://clerk.com/pricing) before implementing team features.
