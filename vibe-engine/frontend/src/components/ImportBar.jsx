import { useState } from 'react'
import { useStore } from '../stores/useStore'

const STAGE_LABELS = {
  starting: 'Starting...',
  resolving: 'Resolving...',
  resolved: 'Found',
  queued: 'Queued',
  downloading: 'Downloading',
  converting: 'Converting',
  cached: 'Cached',
  analyzing: 'Analyzing',
  analyzing_bpm: 'BPM',
  analyzing_key: 'Key',
  analyzing_structure: 'Structure',
  analyzing_energy: 'Mood',
  done: 'Done',
  error: 'Failed',
}

const STAGE_ORDER = [
  'starting', 'resolving', 'resolved', 'queued',
  'downloading', 'converting', 'cached',
  'analyzing', 'analyzing_bpm', 'analyzing_key',
  'analyzing_structure', 'analyzing_energy',
  'done', 'error',
]

function stageIndex(stage) {
  const idx = STAGE_ORDER.indexOf(stage)
  return idx >= 0 ? idx : -1
}

const IMPORT_STEPS = [
  { key: 'resolving', label: 'Find' },
  { key: 'downloading', label: 'Download' },
  { key: 'analyzing', label: 'Analyze' },
  { key: 'done', label: 'Queue' },
]

export default function ImportBar() {
  const [url, setUrl] = useState('')
  const { importTrack, loading, error, importProgress } = useStore()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!url.trim()) return
    importTrack(url.trim())
  }

  const currentStageIdx = importProgress ? stageIndex(importProgress.stage) : -1
  const currentStep = IMPORT_STEPS.findIndex(
    (s) => currentStageIdx >= stageIndex(s.key)
  )

  return (
    <div className="w-full space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a YouTube URL or playlist..."
            className="w-full px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-vibe-500 focus:ring-1 focus:ring-vibe-500 transition-colors disabled:opacity-50"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="btn-primary flex items-center gap-2 min-w-[100px] justify-center"
        >
          {loading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : null}
          {loading ? 'Importing' : 'Import'}
        </button>
      </form>

      {importProgress && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {importProgress.stage === 'done' ? (
              <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : importProgress.stage === 'error' ? (
              <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="animate-spin h-4 w-4 text-vibe-400 shrink-0" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            <span className={importProgress.stage === 'error' ? 'text-red-400' : 'text-gray-200'}>
              {importProgress.message}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {IMPORT_STEPS.map((step, i) => {
              const isActive = i === currentStep
              const isPast = i < currentStep
              return (
                <div key={step.key} className="flex-1 flex items-center gap-2">
                  <div
                    className={`flex-1 h-1.5 rounded-full transition-colors ${
                      isPast ? 'bg-vibe-500' : isActive ? 'bg-vibe-500 animate-pulse' : 'bg-gray-700'
                    }`}
                  />
                  <span
                    className={`text-[10px] whitespace-nowrap ${
                      isPast ? 'text-vibe-400' : isActive ? 'text-white' : 'text-gray-600'
                    }`}
                  >
                    {step.label}
                  </span>
                  {i < IMPORT_STEPS.length - 1 && (
                    <svg className="w-3 h-3 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {error && !importProgress && (
        <p className="text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
