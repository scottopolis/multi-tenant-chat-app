import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../../../convex-backend/convex/_generated/api'
import { useTenant } from '../../../lib/tenant'

export const Route = createFileRoute('/dashboard/agents/new')({
  component: NewAgent,
})

function NewAgent() {
  const navigate = useNavigate()
  const { tenant, isLoading: tenantLoading } = useTenant()
  const createAgent = useMutation(api.agents.create)

  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('gpt-4.1-mini')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenant) return

    setIsSubmitting(true)
    setError(null)

    try {
      const agentId = name.toLowerCase().replace(/\s+/g, '-')
      await createAgent({
        agentId,
        tenantId: tenant.id as any,
        orgId: tenant.clerkOrgId,
        name,
        systemPrompt: prompt,
        model,
      })
      navigate({ to: '/dashboard/agents' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: '/dashboard/agents' })
  }

  if (tenantLoading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <p className="text-white">Loading...</p>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <p className="text-red-400">No tenant found. Please run the seed script.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="md:flex md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-3xl font-bold leading-7 text-white sm:truncate sm:text-3xl sm:tracking-tight">
            Create New Agent
          </h2>
        </div>
      </div>

      <div className="mt-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          <div className="bg-slate-800 shadow rounded-lg p-6">
            <div className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-white">
                  Agent Name
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm sm:leading-6"
                    placeholder="e.g., Customer Support Agent"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="model" className="block text-sm font-medium text-white">
                  Model
                </label>
                <div className="mt-2">
                  <select
                    id="model"
                    name="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm sm:leading-6"
                  >
                    <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="prompt" className="block text-sm font-medium text-white">
                  System Prompt
                </label>
                <div className="mt-2">
                  <textarea
                    id="prompt"
                    name="prompt"
                    rows={10}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm sm:leading-6"
                    placeholder="You are a helpful assistant that..."
                  />
                </div>
                <p className="mt-2 text-sm text-gray-400">
                  Define how your agent should behave and respond to users.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name}
              className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
