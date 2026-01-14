import {
  SignedIn,
  SignedOut,
  SignInButton,
} from '@clerk/tanstack-react-start'
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Landing })

function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <section className="py-24 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 tracking-tight">
            Multi-Tenant Chat Assistant
          </h1>
          <p className="text-xl text-gray-600 mb-4 font-light">
            Build powerful AI chat experiences for your customers
          </p>
          <p className="text-base text-gray-500 max-w-2xl mx-auto mb-10">
            Configure intelligent agents, customize prompts, and embed chat widgets
            into your applications with ease.
          </p>
          <div className="flex flex-col items-center gap-4">
            <SignedIn>
              <Link
                to="/dashboard"
                className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors"
              >
                Go to Dashboard
              </Link>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-lg transition-colors">
                  Sign In to Get Started
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Agent Configuration
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Customize your AI agents with system prompts, model selection, and
                advanced tool integrations.
              </p>
            </div>
            <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Embeddable Widget
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Drop a simple code snippet into your website to add AI-powered chat
                in minutes.
              </p>
            </div>
            <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                Multi-Tenant Ready
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Built for SaaS applications with isolated tenant data and
                configurations.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
