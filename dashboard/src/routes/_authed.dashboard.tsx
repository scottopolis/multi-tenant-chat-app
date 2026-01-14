import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/dashboard')({
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center h-14">
            <div className="flex items-center gap-8">
              <Link
                to="/dashboard"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 py-4 border-b-2 border-transparent transition-colors"
                activeProps={{
                  className:
                    'text-sm font-medium text-gray-900 py-4 border-b-2 border-gray-900',
                }}
                activeOptions={{ exact: true }}
              >
                Home
              </Link>
              <Link
                to="/dashboard/agents"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 py-4 border-b-2 border-transparent transition-colors"
                activeProps={{
                  className:
                    'text-sm font-medium text-gray-900 py-4 border-b-2 border-gray-900',
                }}
              >
                Agents
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto py-8 px-6">
        <Outlet />
      </main>
    </div>
  )
}
