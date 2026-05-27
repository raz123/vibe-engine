import { useStore } from '../stores/useStore'

export default function Queue() {
  const { queue, currentIndex } = useStore()

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider px-1">Up Next</h3>
      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {queue.length === 0 && (
          <p className="text-sm text-gray-600 px-1">Queue is empty</p>
        )}
        {queue.map((item, i) => {
          const isCurrent = i === currentIndex
          const a = item.track.analysis
          return (
            <div
              key={item.track.id}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isCurrent ? 'bg-vibe-900/30 border border-vibe-800/50' : 'hover:bg-gray-800/50'
              }`}
            >
              <span className="text-xs text-gray-600 w-5 text-right shrink-0">
                {isCurrent ? '▶' : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${isCurrent ? 'text-white font-medium' : 'text-gray-300'}`}>
                  {item.track.title}
                </p>
                <p className="text-xs text-gray-500 truncate">{item.track.artist}</p>
              </div>
              {a && (
                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  <span className="chip bg-gray-800 text-gray-400 text-[10px]">{a.bpm.toFixed(0)}</span>
                  <span className="chip bg-gray-800 text-gray-400 text-[10px]">{a.key_camelot}</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
