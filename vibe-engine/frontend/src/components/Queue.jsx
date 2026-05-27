import { useStore } from '../stores/useStore'

export default function Queue() {
  const { queue, currentIndex, library, libraryOpen, fetchLibrary, removeFromQueue, addToQueue, removeFromLibrary } = useStore()

  const queuedIds = new Set(queue.map((item) => item.track.id))
  const nonQueuedTracks = library.filter((item) => !item.in_queue)
  const totalLibrary = library.length

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Up Next</h3>
        {totalLibrary > 0 && (
          <button
            onClick={() => useStore.setState({ libraryOpen: !libraryOpen })}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Library ({totalLibrary})
          </button>
        )}
      </div>

      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {queue.length === 0 && (
          <p className="text-sm text-gray-600 px-1">Queue is empty — import a track</p>
        )}
        {queue.map((item, i) => {
          const isCurrent = i === currentIndex
          const a = item.track.analysis
          return (
            <div
              key={item.track.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors group ${
                isCurrent ? 'bg-vibe-900/30 border border-vibe-800/50' : 'hover:bg-gray-800/50'
              }`}
            >
              <span className="text-xs text-gray-600 w-5 text-right shrink-0">
                {isCurrent ? '\u25B6' : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${isCurrent ? 'text-white font-medium' : 'text-gray-300'}`}>
                  {item.track.title}
                </p>
                <p className="text-xs text-gray-500 truncate">{item.track.artist}</p>
              </div>
              {a && (
                <div className="hidden sm:flex items-center gap-1 shrink-0">
                  <span className="chip bg-gray-800 text-gray-400 text-[10px]">{a.bpm.toFixed(0)}</span>
                  <span className="chip bg-gray-800 text-gray-400 text-[10px]">{a.key_camelot}</span>
                </div>
              )}
              <button
                onClick={() => removeFromQueue(item.track.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all shrink-0"
                title="Remove from queue (keep in library)"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>

      {libraryOpen && (
        <div className="border-t border-gray-800 pt-2 mt-2 space-y-1">
          <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-1">
            Library ({totalLibrary} imported)
          </h4>
          {library.length === 0 && (
            <p className="text-[10px] text-gray-600 px-1">No tracks imported</p>
          )}
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {library.map((entry) => {
              const t = entry.track
              const a = t.analysis
              const isInQueue = entry.in_queue
              return (
                <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-800/50 group">
                  {isInQueue ? (
                    <button
                      onClick={() => removeFromQueue(t.id)}
                      className="text-gray-600 hover:text-red-400 transition-colors shrink-0"
                      title="Remove from queue"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={() => addToQueue(t.id)}
                      className="text-gray-500 hover:text-vibe-400 transition-colors shrink-0"
                      title="Add to queue"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${isInQueue ? 'text-gray-300' : 'text-gray-500'}`}>{t.title}</p>
                    <p className="text-[10px] text-gray-600 truncate">{t.artist}</p>
                  </div>
                  {a && (
                    <span className="chip bg-gray-800 text-gray-500 text-[10px] shrink-0">{a.key_camelot}</span>
                  )}
                  {isInQueue && (
                    <span className="text-[9px] text-vibe-500/60 shrink-0">queued</span>
                  )}
                  <button
                    onClick={() => removeFromLibrary(t.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all shrink-0"
                    title="Remove from library"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
