import {
  SignedIn,
  SignedOut,
  SignInButton,
} from '@clerk/tanstack-react-start'
import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Landing })

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <section className="relative py-20 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10"></div>
        <div className="relative max-w-5xl mx-auto">
          <h1 className="text-6xl md:text-7xl font-black text-white mb-6">
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Multi-Tenant Chat Assistant
            </span>
          </h1>
          <p className="text-2xl md:text-3xl text-gray-300 mb-4 font-light">
            Build powerful AI chat experiences for your customers
          </p>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto mb-8">
            Configure intelligent agents, customize prompts, and embed chat widgets
            into your applications with ease.
          </p>
          <div className="flex flex-col items-center gap-4">
            <SignedIn>
              <Link
                to="/dashboard"
                className="px-8 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-cyan-500/50"
              >
                Go to Dashboard
              </Link>
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-8 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-cyan-500/50">
                  Sign In to Get Started
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
      </section>

      <section className="py-16 px-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-3">
              Agent Configuration
            </h3>
            <p className="text-gray-400 leading-relaxed">
              Customize your AI agents with system prompts, model selection, and
              advanced tool integrations.
            </p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-3">
              Embeddable Widget
            </h3>
            <p className="text-gray-400 leading-relaxed">
              Drop a simple code snippet into your website to add AI-powered chat
              in minutes.
            </p>
          </div>
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-3">
              Multi-Tenant Ready
            </h3>
            <p className="text-gray-400 leading-relaxed">
              Built for SaaS applications with isolated tenant data and
              configurations.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
