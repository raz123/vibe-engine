import { useStore, VIBE_MODES } from '../stores/useStore'

const modeLabels = {
  club: { label: 'Club', icon: '🎧' },
  chill: { label: 'Chill', icon: '🛋️' },
  focus: { label: 'Focus', icon: '🎯' },
  late_night: { label: 'Late Night', icon: '🌙' },
  aggressive: { label: 'Aggressive', icon: '🔥' },
  euphoric: { label: 'Euphoric', icon: '✨' },
  deep_house: { label: 'Deep House', icon: '🎹' },
  experimental: { label: 'Experimental', icon: '🧪' },
}

export default function VibeControl() {
  const { vibeMode, setVibeMode } = useStore()

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider px-1">Vibe Mode</h3>
      <div className="grid grid-cols-2 gap-1.5">
        {VIBE_MODES.map((mode) => {
          const info = modeLabels[mode]
          const isActive = vibeMode === mode
          return (
            <button
              key={mode}
              onClick={() => setVibeMode(mode)}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all ${
                isActive
                  ? 'bg-vibe-600 text-white shadow-lg shadow-vibe-600/20'
                  : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-gray-200 border border-gray-800'
              }`}
            >
              <span className="text-sm">{info.icon}</span>
              <span className="font-medium">{info.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
