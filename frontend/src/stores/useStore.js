import { create } from 'zustand'

const API_BASE = ''
const POLL_INTERVAL = 500

export const VIBE_MODES = [
  'club', 'chill', 'focus', 'late_night',
  'aggressive', 'euphoric', 'deep_house', 'experimental',
]

export const useStore = create((set, get) => ({
  queue: [],
  currentIndex: -1,
  vibeMode: 'club',
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  loading: false,
  error: null,
  transition: null,
  history: [],
  importProgress: null,

  fetchQueue: async () => {
    try {
      const r = await fetch(`${API_BASE}/queue`)
      const data = await r.json()
      set({ queue: data.queue, currentIndex: data.current_index, vibeMode: data.vibe_mode })
    } catch (e) {
      set({ error: e.message })
    }
  },

  importTrack: async (url) => {
    set({ loading: true, error: null, importProgress: { stage: 'starting', message: 'Starting import...' } })
    try {
      const r = await fetch(`${API_BASE}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!r.ok) throw new Error((await r.json()).detail || 'Import failed')
      const data = await r.json()

      if (data.status === 'already_cached') {
        set({ importProgress: { stage: 'done', message: 'Already cached', track: data.track } })
        await get().fetchQueue()
        return
      }

      const jobId = data.job_id
      set({ importProgress: { stage: 'resolving', message: `Resolving: ${data.title || url}` } })

      const poll = setInterval(async () => {
        try {
          const pr = await fetch(`${API_BASE}/import/progress/${jobId}`)
          const p = await pr.json()

          if (p.stage === 'done') {
            clearInterval(poll)
            set({ loading: false, importProgress: null })
            await get().fetchQueue()
          } else if (p.stage === 'error') {
            clearInterval(poll)
            set({ loading: false, error: p.message, importProgress: null })
          } else {
            set({ importProgress: { stage: p.stage, message: p.message } })
          }
        } catch (e) {
          clearInterval(poll)
          set({ loading: false, error: e.message, importProgress: null })
        }
      }, POLL_INTERVAL)
    } catch (e) {
      set({ loading: false, error: e.message, importProgress: null })
    }
  },

  nextTrack: async () => {
    try {
      const r = await fetch(`${API_BASE}/queue/next`, { method: 'POST' })
      if (!r.ok) throw new Error('No more tracks')
      const data = await r.json()
      set({ transition: data.transition })
      await get().fetchQueue()
      return data.track
    } catch (e) {
      set({ error: e.message })
      return null
    }
  },

  advanceQueue: async () => {
    try {
      await fetch(`${API_BASE}/queue/advance`, { method: 'POST' })
      await get().fetchQueue()
    } catch (e) {
      set({ error: e.message })
    }
  },

  skipTrack: async () => {
    const current = get().queue[get().currentIndex]
    if (!current) return
    try {
      await fetch(`${API_BASE}/tracks/${current.track.id}/skip`, { method: 'POST' })
      await get().fetchQueue()
    } catch (e) {
      set({ error: e.message })
    }
  },

  likeTrack: async (trackId) => {
    try {
      await fetch(`${API_BASE}/tracks/${trackId}/like`, { method: 'POST' })
    } catch (e) {
      set({ error: e.message })
    }
  },

  setVibeMode: async (mode) => {
    try {
      await fetch(`${API_BASE}/vibe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      set({ vibeMode: mode })
    } catch (e) {
      set({ error: e.message })
    }
  },

  getTransitionPlan: async () => {
    try {
      const r = await fetch(`${API_BASE}/transition/plan`)
      const data = await r.json()
      set({ transition: data.transition })
      return data
    } catch (e) {
      return null
    }
  },

  clearCache: async () => {
    try {
      await fetch(`${API_BASE}/cache/clear`, { method: 'POST' })
      set({ queue: [], currentIndex: -1 })
    } catch (e) {
      set({ error: e.message })
    }
  },

  setPlaying: (v) => set({ isPlaying: v }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
}))
