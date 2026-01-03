import { useState } from 'react'

interface EmbedCodeProps {
  agentId: string
}

const WIDGET_URL = 'https://multi-tenant-chat-app.pages.dev'

const POSITION_OPTIONS = [
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
]

const ICON_OPTIONS = [
  { value: 'chat', label: 'Chat Bubble' },
  { value: 'help', label: 'Help Circle' },
  { value: 'message', label: 'Message' },
]

export function EmbedCode({ agentId }: EmbedCodeProps) {
  const [color, setColor] = useState('#4F46E5')
  const [position, setPosition] = useState('bottom-right')
  const [icon, setIcon] = useState('chat')
  const [copied, setCopied] = useState<'script' | 'iframe' | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const scriptCode = `<script
  src="${WIDGET_URL}/embed.js"
  data-agent-id="${agentId}"
  data-color="${color}"
  data-position="${position}"
  data-icon="${icon}"
  defer
></script>`

  const iframeCode = `<iframe
  src="${WIDGET_URL}/?agent=${agentId}"
  style="border: none; position: fixed; bottom: 24px; ${position === 'bottom-left' ? 'left' : 'right'}: 24px; 
         width: 360px; height: 520px; z-index: 2147483647; 
         border-radius: 16px; overflow: hidden;"
></iframe>`

  const handleCopy = async (code: string, type: 'script' | 'iframe') => {
    await navigator.clipboard.writeText(code)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-white">Embed Widget</h3>
        <p className="mt-1 text-sm text-gray-400">
          Add the chat widget to any website by copying the embed code below.
        </p>
      </div>

      {/* Customization Options */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label htmlFor="embedColor" className="block text-sm font-medium text-white">
            Button Color
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="color"
              id="embedColor"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-10 rounded border border-slate-600 bg-slate-900 cursor-pointer"
            />
            <input
              type="text"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm font-mono"
            />
          </div>
        </div>

        <div>
          <label htmlFor="embedPosition" className="block text-sm font-medium text-white">
            Position
          </label>
          <div className="mt-2">
            <select
              id="embedPosition"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
            >
              {POSITION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="embedIcon" className="block text-sm font-medium text-white">
            Launcher Icon
          </label>
          <div className="mt-2">
            <select
              id="embedIcon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="block w-full rounded-md border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-cyan-500 sm:text-sm"
            >
              {ICON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Script Embed (Recommended) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="text-sm font-medium text-white">Script Tag</h4>
            <span className="inline-flex items-center rounded-full bg-green-900/50 px-2 py-0.5 text-xs font-medium text-green-400 ml-2">
              Recommended
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(scriptCode, 'script')}
            className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            {copied === 'script' ? (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
        <p className="text-sm text-gray-400 mb-2">
          Paste this script tag before the closing <code className="text-cyan-400">&lt;/body&gt;</code> tag:
        </p>
        <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-300 font-mono whitespace-pre">{scriptCode}</code>
        </pre>
      </div>

      {/* Direct Iframe */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-white">Direct Iframe</h4>
          <button
            type="button"
            onClick={() => handleCopy(iframeCode, 'iframe')}
            className="text-sm text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            {copied === 'iframe' ? (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
        <p className="text-sm text-gray-400 mb-2">
          For full control over positioning and styling:
        </p>
        <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
          <code className="text-sm text-gray-300 font-mono whitespace-pre">{iframeCode}</code>
        </pre>
      </div>

      {/* Interactive Preview */}
      <div>
        <h4 className="text-sm font-medium text-white mb-2">Live Preview</h4>
        <p className="text-sm text-gray-400 mb-3">
          Click the launcher button to test the actual widget with your agent.
        </p>
        <div className="bg-slate-900 rounded-lg relative h-[500px] overflow-hidden">
          <div className="absolute top-4 left-4 text-sm text-gray-500">Your website content...</div>
          
          {/* Live iframe when open */}
          {previewOpen && (
            <iframe
              src={`${WIDGET_URL}/?agent=${agentId}`}
              className="absolute border-none rounded-2xl shadow-2xl"
              style={{
                width: '380px',
                height: '450px',
                bottom: '88px',
                [position === 'bottom-left' ? 'left' : 'right']: '24px',
              }}
            />
          )}
          
          {/* Launcher button */}
          <button
            type="button"
            onClick={() => setPreviewOpen(!previewOpen)}
            className="absolute flex items-center justify-center w-14 h-14 rounded-full shadow-lg cursor-pointer transition-transform hover:scale-105"
            style={{
              backgroundColor: color,
              bottom: '24px',
              [position === 'bottom-left' ? 'left' : 'right']: '24px',
            }}
          >
            {previewOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <>
                {icon === 'chat' && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                )}
                {icon === 'help' && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                )}
                {icon === 'message' && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                )}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Auto-Open Tip */}
      <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm font-medium text-white mb-1">💡 Pro Tip: Auto-Open Widget</h4>
        <p className="text-sm text-gray-400">
          Add <code className="text-cyan-400">?chat=open</code> to any URL to automatically open the chat widget when the page loads.
          Useful for support links or help buttons.
        </p>
      </div>
    </div>
  )
}
