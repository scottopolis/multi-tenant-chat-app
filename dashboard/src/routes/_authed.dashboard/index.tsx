import { useUser } from '@clerk/tanstack-react-start'
import { useMutation } from 'convex/react'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useTenant } from '../../lib/tenant'
import { api } from '../../../../convex-backend/convex/_generated/api'
import { UsageChart } from '../../components/UsageChart'

export const Route = createFileRoute('/_authed/dashboard/')({
  component: DashboardHome,
})

function DashboardHome() {
  const { tenant, isLoading } = useTenant()
  const { user } = useUser()
  const createTenant = useMutation(api.tenants.create)
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [provisionError, setProvisionError] = useState<string | null>(null)

  const provisionTenant = async () => {
    if (!user) return
    setIsProvisioning(true)
    setProvisionError(null)
    try {
      await createTenant({
        clerkUserId: user.id,
        name: user.fullName || user.primaryEmailAddress?.emailAddress || 'My Workspace',
      })
    } catch (error) {
      console.error('Failed to provision tenant:', error)
      setProvisionError(error instanceof Error ? error.message : 'Failed to set up workspace')
    }
    setIsProvisioning(false)
  }

  useEffect(() => {
    if (!isLoading && !tenant && user && !isProvisioning && !provisionError) {
      provisionTenant()
    }
  }, [isLoading, tenant, user, isProvisioning, provisionError])

  if (provisionError) {
    return (
      <div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md">
          <h3 className="text-red-800 font-medium mb-2">Setup Failed</h3>
          <p className="text-red-600 text-sm mb-4">{provisionError}</p>
          <button
            onClick={provisionTenant}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (isLoading || isProvisioning || !tenant) {
    return (
      <div>
        <p className="text-gray-500">
          {isProvisioning ? 'Setting up your workspace...' : 'Loading...'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-1">
          Welcome to your Dashboard
        </h2>
        <p className="text-gray-500">
          View your account usage and analytics below.
        </p>
      </div>
      <UsageChart />
    </div>
  )
}
