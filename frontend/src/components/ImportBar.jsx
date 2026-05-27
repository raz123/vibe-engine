import { useState } from 'react'
import { useStore } from '../stores/useStore'

export default function ImportBar() {
  const [url, setUrl] = useState('')
  const { importTrack, loading, error } = useStore()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!url.trim()) return
    importTrack(url.trim())
    setUrl('')
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube URL or playlist..."
          className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:border-vibe-500 focus:ring-1 focus:ring-vibe-500 transition-colors"
          disabled={loading}
        />
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
          {loading ? 'Importing...' : 'Import'}
        </button>
      </form>
      {error && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
