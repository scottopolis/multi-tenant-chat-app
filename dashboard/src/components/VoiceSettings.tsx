import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex-backend/convex/_generated/api'
import type { Id } from '../../../convex-backend/convex/_generated/dataModel'
import { useTenant } from '../lib/tenant'
import { VoicePreview } from './VoicePreview'

interface VoiceSettingsProps {
  agentId: string // Human-readable agent ID (for display/logging)
  agentDbId: Id<'agents'>
}

// agentId kept for future logging/analytics purposes

const VOICE_MODELS = [
  { value: 'gpt-realtime', label: 'GPT Realtime' },
  { value: 'gpt-4o-realtime-preview', label: 'GPT-4o Realtime Preview' },
]

const VOICE_PERSONAS = [
  { value: 'verse', label: 'Verse' },
  { value: 'alloy', label: 'Alloy' },
  { value: 'echo', label: 'Echo' },
  { value: 'fable', label: 'Fable' },
  { value: 'onyx', label: 'Onyx' },
  { value: 'nova', label: 'Nova' },
  { value: 'shimmer', label: 'Shimmer' },
]

const LOCALES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'es-MX', label: 'Spanish (Mexico)' },
  { value: 'fr-FR', label: 'French' },
  { value: 'de-DE', label: 'German' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'ja-JP', label: 'Japanese' },
  { value: 'ko-KR', label: 'Korean' },
  { value: 'zh-CN', label: 'Chinese (Simplified)' },
]

export function VoiceSettings({ agentId: _agentId, agentDbId }: VoiceSettingsProps) {
  void _agentId // Reserved for future analytics/logging
  const { tenant } = useTenant()

  const voiceAgent = useQuery(api.voiceAgents.getByAgentId, { agentId: agentDbId })
  const twilioNumbers = useQuery(
    api.twilioNumbers.listByAgent,
    { agentId: agentDbId }
  )

  const createVoiceAgent = useMutation(api.voiceAgents.create)
  const updateVoiceAgent = useMutation(api.voiceAgents.update)
  const deleteVoiceAgent = useMutation(api.voiceAgents.remove)

  const createTwilioNumber = useMutation(api.twilioNumbers.create)
  const deleteTwilioNumber = useMutation(api.twilioNumbers.remove)

  const [enabled, setEnabled] = useState(false)
  const [voiceModel, setVoiceModel] = useState('gpt-4o-realtime-preview')
  const [voiceName, setVoiceName] = useState('verse')
  const [locale, setLocale] = useState('en-US')
  const [bargeInEnabled, setBargeInEnabled] = useState(true)

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [showAddNumber, setShowAddNumber] = useState(false)
  const [newPhoneNumber, setNewPhoneNumber] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [isAddingNumber, setIsAddingNumber] = useState(false)

  useEffect(() => {
    if (voiceAgent) {
      setEnabled(voiceAgent.enabled)
      setVoiceModel(voiceAgent.voiceModel)
      setVoiceName(voiceAgent.voiceName || 'verse')
      setLocale(voiceAgent.locale)
      setBargeInEnabled(voiceAgent.bargeInEnabled)
    }
  }, [voiceAgent])

  const handleSave = async () => {
    if (!tenant) return
    setIsSaving(true)
    setError(null)
    setSuccessMessage(null)

    try {
      if (voiceAgent) {
        await updateVoiceAgent({
          id: voiceAgent._id,
          voiceModel,
          voiceName,
          locale,
          bargeInEnabled,
          enabled,
        })
      } else if (enabled) {
        await createVoiceAgent({
          tenantId: tenant.id as Id<'tenants'>,
          agentId: agentDbId,
          voiceModel,
          voiceName,
          locale,
          bargeInEnabled,
          enabled: true,
        })
      }
      setSuccessMessage('Voice settings saved successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save voice settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDisableVoice = async () => {
    if (!voiceAgent) return
    if (!confirm('Are you sure you want to disable voice for this agent? This will also remove all phone number mappings.')) {
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await deleteVoiceAgent({ id: voiceAgent._id })
      setEnabled(false)
      setSuccessMessage('Voice disabled successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable voice')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddNumber = async () => {
    if (!tenant || !voiceAgent || !newPhoneNumber) return

    setIsAddingNumber(true)
    setError(null)

    try {
      const normalizedNumber = newPhoneNumber.startsWith('+') ? newPhoneNumber : `+${newPhoneNumber.replace(/\D/g, '')}`
      
      await createTwilioNumber({
        tenantId: tenant.id as Id<'tenants'>,
        agentId: agentDbId,
        voiceAgentId: voiceAgent._id,
        phoneNumber: normalizedNumber,
        description: newDescription || undefined,
      })
      
      setNewPhoneNumber('')
      setNewDescription('')
      setShowAddNumber(false)
      setSuccessMessage('Phone number added successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add phone number')
    } finally {
      setIsAddingNumber(false)
    }
  }

  const handleDeleteNumber = async (numberId: Id<'twilioNumbers'>) => {
    if (!confirm('Are you sure you want to remove this phone number?')) return

    try {
      await deleteTwilioNumber({ id: numberId })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove phone number')
    }
  }

  const formatPhoneNumber = (number: string) => {
    if (number.length === 12 && number.startsWith('+1')) {
      return `+1 (${number.slice(2, 5)}) ${number.slice(5, 8)}-${number.slice(8)}`
    }
    return number
  }

  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin.replace('3000', '8787')}/twilio/voice`
    : 'https://your-worker.example.com/twilio/voice'

  const isLoading = voiceAgent === undefined

  if (isLoading) {
    return (
      <div className="space-y-6">
        <p className="text-gray-400">Loading voice settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white">Voice Settings</h3>
        <p className="mt-1 text-sm text-gray-400">
          Enable voice capabilities for this agent via Twilio phone numbers.
        </p>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-900/50 border border-green-500 rounded-lg p-3">
          <p className="text-green-400 text-sm">{successMessage}</p>
        </div>
      )}

      {/* Enable Voice Toggle */}
      <div className="bg-slate-900 rounded-lg p-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
          />
          <span className="text-white font-medium">Enable voice for this agent</span>
        </label>
      </div>

      {enabled && (
        <>
          {/* Voice Configuration */}
          <div className="bg-slate-900 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="voiceModel" className="block text-sm font-medium text-white">
                  Model
                </label>
                <select
                  id="voiceModel"
                  value={voiceModel}
                  onChange={(e) => setVoiceModel(e.target.value)}
                  className="mt-2 block w-full rounded-md border-0 bg-slate-800 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                >
                  {VOICE_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="voiceName" className="block text-sm font-medium text-white">
                  Voice
                </label>
                <select
                  id="voiceName"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  className="mt-2 block w-full rounded-md border-0 bg-slate-800 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                >
                  {VOICE_PERSONAS.map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="locale" className="block text-sm font-medium text-white">
                  Locale
                </label>
                <select
                  id="locale"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  className="mt-2 block w-full rounded-md border-0 bg-slate-800 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                >
                  {LOCALES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-3 pb-2">
                  <input
                    type="checkbox"
                    checked={bargeInEnabled}
                    onChange={(e) => setBargeInEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  <span className="text-white text-sm">Allow barge-in (interruptions)</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              {voiceAgent && (
                <button
                  type="button"
                  onClick={handleDisableVoice}
                  disabled={isSaving}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50"
                >
                  Disable Voice
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-cyan-600 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Voice Settings'}
              </button>
            </div>
          </div>

          {/* Phone Numbers Section */}
          {voiceAgent && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-md font-medium text-white">Phone Numbers</h4>
                <button
                  type="button"
                  onClick={() => setShowAddNumber(true)}
                  className="text-sm text-cyan-400 hover:text-cyan-300"
                >
                  + Add Phone Number
                </button>
              </div>

              {showAddNumber && (
                <div className="bg-slate-900 rounded-lg p-4 space-y-3">
                  <div>
                    <label htmlFor="newPhoneNumber" className="block text-sm font-medium text-white">
                      Phone Number (E.164 format)
                    </label>
                    <input
                      type="tel"
                      id="newPhoneNumber"
                      value={newPhoneNumber}
                      onChange={(e) => setNewPhoneNumber(e.target.value)}
                      placeholder="+15551234567"
                      className="mt-2 block w-full rounded-md border-0 bg-slate-800 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="newDescription" className="block text-sm font-medium text-white">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      id="newDescription"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Main support line"
                      className="mt-2 block w-full rounded-md border-0 bg-slate-800 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddNumber(false)
                        setNewPhoneNumber('')
                        setNewDescription('')
                      }}
                      className="rounded-md bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddNumber}
                      disabled={isAddingNumber || !newPhoneNumber}
                      className="rounded-md bg-cyan-500 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-600 disabled:opacity-50"
                    >
                      {isAddingNumber ? 'Adding...' : 'Add Number'}
                    </button>
                  </div>
                </div>
              )}

              {twilioNumbers === undefined ? (
                <p className="text-gray-500 text-sm italic">Loading phone numbers...</p>
              ) : twilioNumbers.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No phone numbers configured yet.</p>
              ) : (
                <div className="space-y-2">
                  {twilioNumbers.map((number) => (
                    <div
                      key={number._id}
                      className="flex items-center justify-between bg-slate-900 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-3">
                        <svg
                          className="h-5 w-5 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                          />
                        </svg>
                        <div>
                          <p className="text-sm text-white font-medium">
                            {formatPhoneNumber(number.phoneNumber)}
                          </p>
                          {number.description && (
                            <p className="text-xs text-gray-500">{number.description}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteNumber(number._id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Integration Instructions */}
          {voiceAgent && (
            <div className="bg-slate-900 rounded-lg p-4 space-y-3">
              <h4 className="text-md font-medium text-white">Integration</h4>
              <div>
                <label className="block text-sm font-medium text-gray-400">Webhook URL</label>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 bg-slate-800 rounded px-3 py-2 text-sm text-cyan-400 font-mono overflow-x-auto">
                    {webhookUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl)
                      setSuccessMessage('Webhook URL copied to clipboard')
                      setTimeout(() => setSuccessMessage(null), 2000)
                    }}
                    className="rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-600"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-400 space-y-1">
                <p className="font-medium text-white">Configure this URL in Twilio Console:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Go to Phone Numbers → Manage → Active numbers</li>
                  <li>Select your phone number</li>
                  <li>Under "Voice Configuration", find "A call comes in"</li>
                  <li>Set to "Webhook" with HTTP POST and paste the URL above</li>
                </ol>
              </div>
            </div>
          )}

          {/* Voice Preview Section */}
          {voiceAgent && (
            <VoicePreview agentDbId={agentDbId} />
          )}
        </>
      )}
    </div>
  )
}
