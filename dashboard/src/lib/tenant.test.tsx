import { describe, it, expect } from 'vitest'

describe('Tenant Provider Logic', () => {
  describe('isLoading calculation', () => {
    const calculateIsLoading = (
      isLoaded: boolean,
      userId: string | null | undefined,
      tenant: unknown | undefined
    ) => {
      return !isLoaded || (userId !== null && tenant === undefined)
    }

    it('should return true when auth is not loaded', () => {
      expect(calculateIsLoading(false, null, undefined)).toBe(true)
    })

    it('should return false when auth is loaded and no user', () => {
      expect(calculateIsLoading(true, null, undefined)).toBe(false)
    })

    it('should return true when user is logged in but tenant is fetching', () => {
      expect(calculateIsLoading(true, 'user_123', undefined)).toBe(true)
    })

    it('should return false when user is logged in and tenant is loaded', () => {
      const mockTenant = { _id: 'tenant_123', name: 'Acme' }
      expect(calculateIsLoading(true, 'user_123', mockTenant)).toBe(false)
    })

    it('should return false when user is logged in and tenant is null (not found)', () => {
      expect(calculateIsLoading(true, 'user_123', null)).toBe(false)
    })
  })

  describe('tenant transformation', () => {
    const transformTenant = (tenant: {
      _id: string
      name: string
      clerkUserId: string
      clerkOrgId?: string
      plan: string
    } | null) => {
      return tenant
        ? {
            id: tenant._id,
            name: tenant.name,
            clerkUserId: tenant.clerkUserId,
            clerkOrgId: tenant.clerkOrgId,
            plan: tenant.plan,
          }
        : null
    }

    it('should return null when tenant is null', () => {
      expect(transformTenant(null)).toBe(null)
    })

    it('should transform tenant correctly', () => {
      const rawTenant = {
        _id: 'tenant_123',
        name: 'Acme Corp',
        clerkUserId: 'user_abc123',
        plan: 'pro',
      }

      expect(transformTenant(rawTenant)).toEqual({
        id: 'tenant_123',
        name: 'Acme Corp',
        clerkUserId: 'user_abc123',
        clerkOrgId: undefined,
        plan: 'pro',
      })
    })

    it('should include clerkOrgId when present', () => {
      const rawTenant = {
        _id: 'tenant_123',
        name: 'Acme Corp',
        clerkUserId: 'user_abc123',
        clerkOrgId: 'org_xyz789',
        plan: 'enterprise',
      }

      expect(transformTenant(rawTenant)).toEqual({
        id: 'tenant_123',
        name: 'Acme Corp',
        clerkUserId: 'user_abc123',
        clerkOrgId: 'org_xyz789',
        plan: 'enterprise',
      })
    })
  })
})
