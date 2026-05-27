import { useEffect, useRef } from 'react'
import { useStore } from '../stores/useStore'
import Visualizer from './Visualizer'

const API_BASE = ''

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function Player() {
  const audioRef = useRef(null)
  const {
    queue, currentIndex, isPlaying, transition,
    setPlaying, setCurrentTime, setDuration,
    nextTrack, advanceQueue, fetchQueue, getTransitionPlan,
  } = useStore()

  const current = queue[currentIndex]

  useEffect(() => {
    fetchQueue()
  }, [])

  useEffect(() => {
    if (!audioRef.current) return
    if (!current) return

    const audioUrl = `${API_BASE}/track/${current.track.id}/audio`
    audioRef.current.src = audioUrl
    audioRef.current.load()

    getTransitionPlan()
  }, [current?.track?.id])

  useEffect(() => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.play().catch(() => {})
    } else {
      audioRef.current.pause()
    }
  }, [isPlaying, current?.track?.id])

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleEnded = async () => {
    await advanceQueue()
    await getTransitionPlan()
    setPlaying(true)
  }

  const togglePlay = () => setPlaying(!isPlaying)

  const handleNext = async () => {
    const track = await nextTrack()
    if (track) setPlaying(true)
  }

  if (!current) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 gap-4 text-gray-500">
        <div className="text-6xl opacity-30">🎵</div>
        <p className="text-lg">Import a track to start the vibe</p>
      </div>
    )
  }

  const a = current.track.analysis

  return (
    <div className="card space-y-4">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      <Visualizer />

      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold truncate">{current.track.title}</h2>
        <p className="text-sm text-gray-400 truncate">{current.track.artist}</p>
      </div>

      {a && (
        <div className="flex flex-wrap justify-center gap-2 text-xs">
          <span className="chip bg-vibe-900/50 text-vibe-300">{a.bpm.toFixed(0)} BPM</span>
          <span className="chip bg-blue-900/50 text-blue-300">{a.key} ({a.key_camelot})</span>
          <span className="chip bg-purple-900/50 text-purple-300">{(a.energy * 100).toFixed(0)}% Energy</span>
          {a.mood.map((m) => (
            <span key={m} className="chip bg-amber-900/50 text-amber-300">{m}</span>
          ))}
        </div>
      )}

      {transition && (
        <div className="text-center text-xs text-gray-500">
          Next transition: <span className="text-vibe-400 font-medium">{transition.transition_type}</span>
          {' · '}{transition.crossfade_duration}s crossfade
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-10 text-right">{formatTime(audioRef.current?.currentTime)}</span>
        <input
          type="range"
          min="0"
          max={audioRef.current?.duration || 0}
          value={audioRef.current?.currentTime || 0}
          onChange={(e) => { if (audioRef.current) audioRef.current.currentTime = e.target.value }}
          className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-vibe-500 [&::-webkit-slider-thumb]:rounded-full"
        />
        <span className="text-xs text-gray-500 w-10">{formatTime(audioRef.current?.duration)}</span>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button onClick={handleNext} className="btn-ghost" title="Next track">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6l8.5 6L6 18V6zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
        <button
          onClick={togglePlay}
          className="w-14 h-14 flex items-center justify-center bg-vibe-600 hover:bg-vibe-500 rounded-full transition-colors"
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>
        <button onClick={handleNext} className="btn-ghost" title="Skip">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
