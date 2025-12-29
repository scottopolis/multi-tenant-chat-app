import { createContext, useContext, type ReactNode } from 'react'

export interface Tenant {
  id: string
  name: string
  apiKey: string
}

interface TenantContextValue {
  tenant: Tenant
  isLoading: false
}

const TenantContext = createContext<TenantContextValue | null>(null)

const DEV_TENANT: Tenant = {
  id: 'dev-tenant-001',
  name: 'Development Tenant',
  apiKey: 'dev-api-key-placeholder',
}

export function TenantProvider({ children }: { children: ReactNode }) {
  return (
    <TenantContext.Provider value={{ tenant: DEV_TENANT, isLoading: false }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}
