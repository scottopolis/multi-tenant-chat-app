import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardHome,
})

function DashboardHome() {
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
