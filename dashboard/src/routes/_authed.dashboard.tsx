import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/dashboard')({
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <div className="min-h-screen bg-slate-900">
      <nav className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link
                to="/dashboard"
                className="flex items-center px-2 py-2 text-cyan-400 text-lg font-semibold"
              >
                Chat Assistant
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-300 hover:text-white"
                  activeProps={{
                    className:
                      'inline-flex items-center px-1 pt-1 text-sm font-medium text-white border-b-2 border-cyan-500',
                  }}
                >
                  Home
                </Link>
                <Link
                  to="/dashboard/agents"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-300 hover:text-white"
                  activeProps={{
                    className:
                      'inline-flex items-center px-1 pt-1 text-sm font-medium text-white border-b-2 border-cyan-500',
                  }}
                >
                  Agents
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
