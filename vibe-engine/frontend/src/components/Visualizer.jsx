import { useStore } from '../stores/useStore'

export default function Visualizer() {
  const { isPlaying } = useStore()
  const bars = 32

  return (
    <div className="flex items-end justify-center gap-[2px] h-24">
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          className="w-[6px] bg-gradient-to-t from-vibe-500 to-vibe-300 rounded-t-sm"
          style={{
            height: isPlaying ? `${20 + Math.random() * 80}%` : '8%',
            animation: isPlaying ? `equalizer 1.2s ease-in-out infinite` : 'none',
            animationDelay: `${i * 0.08}s`,
            transition: 'height 0.1s ease',
            opacity: isPlaying ? 0.9 : 0.2,
          }}
        />
      ))}
    </div>
  )
}
