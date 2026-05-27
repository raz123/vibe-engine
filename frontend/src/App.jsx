import Player from './components/Player'
import Queue from './components/Queue'
import VibeControl from './components/VibeControl'
import ImportBar from './components/ImportBar'
import { useStore } from './stores/useStore'

function EqualizerIcon() {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="w-[3px] bg-vibe-500 rounded-t-sm equalizer-bar"
          style={{ '--i': i, height: `${30 + i * 15}%` }}
        />
      ))}
    </div>
  )
}

export default function App() {
  const { clearCache } = useStore()

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <EqualizerIcon />
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Vibe Engine</h1>
              <p className="text-xs text-gray-500">autonomous vibe engine</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-gray-600">v0.1.0</span>
            <button onClick={clearCache} className="btn-ghost text-xs" title="Clear cache">
              Clear Cache
            </button>
          </div>
        </header>

        <div className="space-y-4 mb-6">
          <ImportBar />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Player />
          </div>
          <div className="space-y-4">
            <VibeControl />
            <Queue />
          </div>
        </div>
      </div>
    </div>
  )
}
