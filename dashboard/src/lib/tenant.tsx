import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from 'convex/react'
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

const DEV_CLERK_ORG_ID = 'org_acme_corp'

export function TenantProvider({ children }: { children: ReactNode }) {
  const tenant = useQuery(api.tenants.getByClerkOrgId, {
    clerkOrgId: DEV_CLERK_ORG_ID,
  })

  const value: TenantContextValue = {
    tenant: tenant
      ? {
          id: tenant._id,
          name: tenant.name,
          clerkOrgId: tenant.clerkOrgId,
          plan: tenant.plan,
        }
      : null,
    isLoading: tenant === undefined,
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
