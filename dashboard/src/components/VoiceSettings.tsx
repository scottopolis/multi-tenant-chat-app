import { forwardRef, useImperativeHandle, useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex-backend/convex/_generated/api'
import type { Id } from '../../../convex-backend/convex/_generated/dataModel'
import { useTenant } from '../lib/tenant'
import { VoicePreview } from './VoicePreview'
import { getWorkerHost } from '../lib/workerHost'

export interface VoiceSettingsHandle {
  save: () => Promise<void>
}

interface VoiceSettingsProps {
  agentId: string
  agentDbId: Id<'agents'>
  onDirtyChange?: (dirty: boolean) => void
}

const DEFAULT_STT_MODEL = 'nova-3'
const DEFAULT_TTS_MODEL = 'aura-2-thalia-en'
const DEFAULT_TTS_VOICE = ''

const TTS_VOICE_OPTIONS = [
  { value: 'thalia', label: 'Thalia', model: 'aura-2-thalia-en' },
  { value: 'andromeda', label: 'Andromeda', model: 'aura-2-andromeda-en' },
  { value: 'helena', label: 'Helena', model: 'aura-2-helena-en' },
  { value: 'apollo', label: 'Apollo', model: 'aura-2-apollo-en' },
  { value: 'arcas', label: 'Arcas', model: 'aura-2-arcas-en' },
  { value: 'aries', label: 'Aries', model: 'aura-2-aries-en' },
  { value: 'celeste', label: 'Celeste', model: 'aura-2-celeste-es' },
  { value: 'estrella', label: 'Estrella', model: 'aura-2-estrella-es' },
  { value: 'nestor', label: 'Nestor', model: 'aura-2-nestor-es' },
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

export const VoiceSettings = forwardRef<VoiceSettingsHandle, VoiceSettingsProps>(function VoiceSettings(
  { agentId: _agentId, agentDbId, onDirtyChange },
  ref
) {
  void _agentId
  const { tenant } = useTenant()

  const voiceAgent = useQuery(api.voiceAgents.getByAgentId, { agentId: agentDbId })
  const twilioNumbers = useQuery(
    api.twilioNumbers.listByAgent,
    { agentId: agentDbId }
  )

  const createVoiceAgent = useMutation(api.voiceAgents.create)
  const updateVoiceAgent = useMutation(api.voiceAgents.update)
  const createTwilioNumber = useMutation(api.twilioNumbers.create)
  const deleteTwilioNumber = useMutation(api.twilioNumbers.remove)

  const [sttModel, setSttModel] = useState(DEFAULT_STT_MODEL)
  const [ttsModel, setTtsModel] = useState(DEFAULT_TTS_MODEL)
  const [ttsVoice, setTtsVoice] = useState(DEFAULT_TTS_VOICE)
  const [locale, setLocale] = useState('en-US')
  const [bargeInEnabled, setBargeInEnabled] = useState(true)
  const [lastSaved, setLastSaved] = useState<{
    sttModel: string
    ttsModel: string
    ttsVoice: string
    locale: string
    bargeInEnabled: boolean
  } | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [showAddNumber, setShowAddNumber] = useState(false)
  const [newPhoneNumber, setNewPhoneNumber] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [isAddingNumber, setIsAddingNumber] = useState(false)

  const normalizeSettings = (settings: {
    sttModel?: string
    ttsModel?: string
    ttsVoice?: string
    locale?: string
    bargeInEnabled?: boolean
  }) => ({
    sttModel: settings.sttModel || DEFAULT_STT_MODEL,
    ttsModel: settings.ttsModel || DEFAULT_TTS_MODEL,
    ttsVoice: (settings.ttsVoice || DEFAULT_TTS_VOICE).trim(),
    locale: settings.locale || 'en-US',
    bargeInEnabled: settings.bargeInEnabled ?? true,
  })

  useEffect(() => {
    if (voiceAgent === undefined) return
    const next = normalizeSettings({
      sttModel: voiceAgent?.sttModel,
      ttsModel: voiceAgent?.ttsModel,
      ttsVoice: voiceAgent?.ttsVoice,
      locale: voiceAgent?.locale,
      bargeInEnabled: voiceAgent?.bargeInEnabled,
    })
    const shouldSync =
      !lastSaved ||
      next.sttModel !== lastSaved.sttModel ||
      next.ttsModel !== lastSaved.ttsModel ||
      next.ttsVoice !== lastSaved.ttsVoice ||
      next.locale !== lastSaved.locale ||
      next.bargeInEnabled !== lastSaved.bargeInEnabled
    if (!shouldSync) return
    setSttModel(next.sttModel)
    setTtsModel(next.ttsModel)
    setTtsVoice(next.ttsVoice)
    setLocale(next.locale)
    setBargeInEnabled(next.bargeInEnabled)
    setLastSaved(next)
  }, [lastSaved, voiceAgent])

  useEffect(() => {
    if (!onDirtyChange || !lastSaved) return
    const normalized = normalizeSettings({ sttModel, ttsModel, ttsVoice, locale, bargeInEnabled })
    const dirty =
      normalized.sttModel !== lastSaved.sttModel ||
      normalized.ttsModel !== lastSaved.ttsModel ||
      normalized.ttsVoice !== lastSaved.ttsVoice ||
      normalized.locale !== lastSaved.locale ||
      normalized.bargeInEnabled !== lastSaved.bargeInEnabled
    onDirtyChange(dirty)
  }, [bargeInEnabled, lastSaved, locale, onDirtyChange, sttModel, ttsModel, ttsVoice])

  const hasKnownVoice = TTS_VOICE_OPTIONS.some((option) => option.model === ttsModel)
  const voiceOptions = hasKnownVoice
    ? TTS_VOICE_OPTIONS
    : [{ value: 'custom', label: `Custom (${ttsModel})`, model: ttsModel }, ...TTS_VOICE_OPTIONS]

  const handleSave = async () => {
    if (!tenant || voiceAgent === undefined) return
    setError(null)
    setSuccessMessage(null)

    try {
      const normalizedTtsVoice = ttsVoice.trim() ? ttsVoice.trim() : undefined
      if (voiceAgent) {
        await updateVoiceAgent({
          id: voiceAgent._id,
          sttProvider: 'deepgram',
          ttsProvider: 'deepgram',
          sttModel,
          ttsModel,
          ttsVoice: normalizedTtsVoice,
          locale,
          bargeInEnabled,
        })
      } else {
        await createVoiceAgent({
          tenantId: tenant.id as Id<'tenants'>,
          agentId: agentDbId,
          sttProvider: 'deepgram',
          ttsProvider: 'deepgram',
          sttModel,
          ttsModel,
          ttsVoice: normalizedTtsVoice,
          locale,
          bargeInEnabled,
          enabled: true,
        })
      }
      setLastSaved(
        normalizeSettings({
          sttModel,
          ttsModel,
          ttsVoice,
          locale,
          bargeInEnabled,
        })
      )
      setSuccessMessage('Voice settings saved successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save voice settings')
    }
  }

  useImperativeHandle(ref, () => ({ save: handleSave }), [handleSave])

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

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${getWorkerHost()}/twilio/voice`
      : 'https://your-worker.example.com/twilio/voice'

  const isLoading = voiceAgent === undefined

  if (isLoading) {
    return (
      <div className="space-y-6">
        <p className="text-gray-500">Loading voice settings...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-green-700 text-sm">{successMessage}</p>
        </div>
      )}

      <>
          {/* Voice Configuration */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="ttsVoiceSelect" className="block text-sm font-medium text-gray-900">
                  Voice
                </label>
                <select
                  id="ttsVoiceSelect"
                  value={ttsModel}
                  onChange={(e) => {
                    setTtsModel(e.target.value)
                    setTtsVoice('')
                  }}
                  className="mt-2 block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                >
                  {voiceOptions.map((option) => (
                    <option key={option.model} value={option.model}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  Voices map to the Aura TTS model for that voice.
                </p>
              </div>
              <div>
                <label htmlFor="locale" className="block text-sm font-medium text-gray-900">
                  Locale
                </label>
                <select
                  id="locale"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  className="mt-2 block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                >
                  {LOCALES.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-end">
                <label className="flex items-center gap-3 pb-2">
                  <input
                    type="checkbox"
                    checked={bargeInEnabled}
                    onChange={(e) => setBargeInEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="text-gray-700 text-sm">Allow barge-in (interruptions)</span>
                </label>
              </div>
            </div>

          </div>

          {/* Phone Numbers Section */}
          {voiceAgent && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900">Phone Numbers</h4>
                <button
                  type="button"
                  onClick={() => setShowAddNumber(true)}
                  className="text-sm text-gray-900 hover:text-gray-600 font-medium"
                >
                  + Add Phone Number
                </button>
              </div>

              {showAddNumber && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                  <div>
                    <label htmlFor="newPhoneNumber" className="block text-sm font-medium text-gray-900">
                      Phone Number (E.164 format)
                    </label>
                    <input
                      type="tel"
                      id="newPhoneNumber"
                      value={newPhoneNumber}
                      onChange={(e) => setNewPhoneNumber(e.target.value)}
                      placeholder="+15551234567"
                      className="mt-2 block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="newDescription" className="block text-sm font-medium text-gray-900">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      id="newDescription"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Main support line"
                      className="mt-2 block w-full rounded-lg border border-gray-300 bg-white py-2.5 px-3 text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900 sm:text-sm"
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
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddNumber}
                      disabled={isAddingNumber || !newPhoneNumber}
                      className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                    >
                      {isAddingNumber ? 'Adding...' : 'Add Number'}
                    </button>
                  </div>
                </div>
              )}

              {twilioNumbers === undefined ? (
                <p className="text-gray-400 text-sm italic">Loading phone numbers...</p>
              ) : twilioNumbers.length === 0 ? (
                <p className="text-gray-400 text-sm italic">No phone numbers configured yet.</p>
              ) : (
                <div className="space-y-2">
                  {twilioNumbers.map((number) => (
                    <div
                      key={number._id}
                      className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg p-3"
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
                          <p className="text-sm text-gray-900 font-medium">
                            {formatPhoneNumber(number.phoneNumber)}
                          </p>
                          {number.description && (
                            <p className="text-xs text-gray-500">{number.description}</p>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteNumber(number._id)}
                        className="text-red-600 hover:text-red-500 text-sm font-medium"
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
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium text-gray-900">Integration</h4>
              <div>
                <label className="block text-sm font-medium text-gray-500">Webhook URL</label>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono overflow-x-auto">
                    {webhookUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(webhookUrl)
                      setSuccessMessage('Webhook URL copied to clipboard')
                      setTimeout(() => setSuccessMessage(null), 2000)
                    }}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p className="font-medium text-gray-900">Configure this URL in Twilio Console:</p>
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
    </div>
  )
})

VoiceSettings.displayName = 'VoiceSettings'
