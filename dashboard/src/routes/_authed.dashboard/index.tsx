import { useUser } from '@clerk/tanstack-react-start'
import { useMutation } from 'convex/react'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTenant } from '../../lib/tenant'
import { api } from '../../../../convex-backend/convex/_generated/api'

export const Route = createFileRoute('/_authed/dashboard/')({
  component: DashboardHome,
})

function DashboardHome() {
  const { tenant, isLoading } = useTenant()
  const { user } = useUser()
  const createTenant = useMutation(api.tenants.create)
  const [isProvisioning, setIsProvisioning] = useState(false)

  useEffect(() => {
    async function provisionTenant() {
      if (!isLoading && !tenant && user && !isProvisioning) {
        setIsProvisioning(true)
        try {
          await createTenant({
            clerkUserId: user.id,
            name: user.fullName || user.primaryEmailAddress?.emailAddress || 'My Workspace',
          })
        } catch (error) {
          console.error('Failed to provision tenant:', error)
        }
        setIsProvisioning(false)
      }
    }
    provisionTenant()
  }, [isLoading, tenant, user, isProvisioning, createTenant])

  if (isLoading || isProvisioning || !tenant) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="text-gray-400">
          {isProvisioning ? 'Setting up your workspace...' : 'Loading...'}
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="border-4 border-dashed border-slate-700 rounded-lg h-96 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Welcome to your Dashboard
          </h2>
          <p className="text-gray-400">
            Usage overview and analytics will be displayed here.
          </p>
        </div>
      </div>
    </div>
  )
}
