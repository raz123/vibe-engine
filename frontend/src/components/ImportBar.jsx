import { useState } from 'react'
import { useStore } from '../stores/useStore'

const STAGE_LABELS = {
  starting: 'Starting...',
  resolving: 'Resolving track...',
  resolved: 'Track found',
  downloading: 'Downloading from YouTube...',
  converting: 'Converting audio...',
  cached: 'Using cached audio',
  normalizing: 'Normalizing loudness...',
  analyzing: 'Analyzing track...',
  analyzing_bpm: 'Detecting BPM...',
  analyzing_key: 'Detecting musical key...',
  analyzing_structure: 'Analyzing structure...',
  analyzing_energy: 'Computing energy and mood...',
  done: 'Complete!',
  error: 'Failed',
}

const STAGE_ORDER = [
  'starting', 'resolving', 'resolved',
  'downloading', 'converting', 'cached',
  'normalizing', 'analyzing',
  'analyzing_bpm', 'analyzing_key', 'analyzing_structure', 'analyzing_energy',
  'done', 'error',
]

function stageIndex(stage) {
  const idx = STAGE_ORDER.indexOf(stage)
  return idx >= 0 ? idx : -1
}

export default function ImportBar() {
  const [url, setUrl] = useState('')
  const { importTrack, loading, error, importProgress } = useStore()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!url.trim()) return
    importTrack(url.trim())
  }

  const currentStageIdx = importProgress ? stageIndex(importProgress.stage) : -1

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
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-3 space-y-2">
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
          <div className="flex gap-1">
            {STAGE_ORDER.filter((s) => s !== 'done' && s !== 'error' && s !== 'starting').map((stage) => {
              const idx = stageIndex(stage)
              const isActive = idx === currentStageIdx
              const isPast = idx < currentStageIdx
              return (
                <div
                  key={stage}
                  className={`flex-1 h-1 rounded-full transition-colors ${
                    isPast ? 'bg-vibe-500' : isActive ? 'bg-vibe-500 animate-pulse' : 'bg-gray-700'
                  }`}
                  title={STAGE_LABELS[stage] || stage}
                />
              )
            })}
          </div>
          <div className="flex flex-wrap gap-1.5 text-[10px] text-gray-500">
            {STAGE_ORDER.filter((s) => s !== 'starting').map((stage) => {
              const idx = stageIndex(stage)
              const isActive = idx === currentStageIdx
              const isPast = idx < currentStageIdx
              if (stage === 'done' || stage === 'error') return null
              return (
                <span
                  key={stage}
                  className={`px-1.5 py-0.5 rounded ${
                    isPast ? 'text-vibe-400 bg-vibe-900/30' : isActive ? 'text-white bg-vibe-800/50' : 'text-gray-600'
                  }`}
                >
                  {STAGE_LABELS[stage] || stage}
                </span>
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
