import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/dashboard/agents/new')({
  component: NewAgent,
})

function NewAgent() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Save agent to backend/storage
    console.log('Creating agent:', { name, prompt })
    // Navigate back to agents list
    navigate({ to: '/dashboard/agents' })
  }

  const handleCancel = () => {
    navigate({ to: '/dashboard/agents' })
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
          <div className="bg-slate-800 shadow rounded-lg p-6">
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-white"
                >
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
                <label
                  htmlFor="prompt"
                  className="block text-sm font-medium text-white"
                >
                  System Prompt
                </label>
                <div className="mt-2">
                  <textarea
                    id="prompt"
                    name="prompt"
                    rows={10}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    required
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
              className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
            >
              Create Agent
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
