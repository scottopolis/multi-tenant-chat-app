import { createFileRoute } from '@tanstack/react-router'
import { useTenant } from '../../lib/tenant'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardHome,
})

function DashboardHome() {
  const { tenant, isLoading } = useTenant()

  if (isLoading || !tenant) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="text-gray-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6 p-4 bg-amber-900/30 border border-amber-600/50 rounded-lg">
        <p className="text-amber-200 text-sm">
          <strong>Dev Mode:</strong> Using mock tenant "{tenant.name}" (ID: {tenant.id})
        </p>
      </div>

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
