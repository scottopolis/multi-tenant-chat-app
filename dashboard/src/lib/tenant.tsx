import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from 'convex/react'
import { useAuth } from '@clerk/tanstack-react-start'
import { api } from '../../../convex-backend/convex/_generated/api'

export interface Tenant {
  id: string
  name: string
  clerkUserId: string
  clerkOrgId?: string // For future team support
  plan: string
}

interface TenantContextValue {
  tenant: Tenant | null
  isLoading: boolean
}

const TenantContext = createContext<TenantContextValue | null>(null)

export function TenantProvider({ children }: { children: ReactNode }) {
  const { userId, isLoaded } = useAuth()

  const tenant = useQuery(
    api.tenants.getByClerkUserId,
    userId ? { clerkUserId: userId } : 'skip'
  )

  const isLoading = !isLoaded || (userId !== null && tenant === undefined)

  const value: TenantContextValue = {
    tenant: tenant
      ? {
          id: tenant._id,
          name: tenant.name,
          clerkUserId: tenant.clerkUserId,
          clerkOrgId: tenant.clerkOrgId,
          plan: tenant.plan,
        }
      : null,
    isLoading,
  }

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}
