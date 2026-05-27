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

  pollSingleImport: async (jobId) => {
    return new Promise((resolve) => {
      const poll = setInterval(async () => {
        try {
          const pr = await fetch(`${API_BASE}/import/progress/${jobId}`)
          const p = await pr.json()

          if (p.stage === 'done') {
            clearInterval(poll)
            resolve({ success: true })
          } else if (p.stage === 'error') {
            clearInterval(poll)
            resolve({ success: false, error: p.message })
          } else {
            set({ importProgress: { stage: p.stage, message: p.message } })
          }
        } catch (e) {
          clearInterval(poll)
          resolve({ success: false, error: e.message })
        }
      }, POLL_INTERVAL)
    })
  },

  pollPlaylistImport: async (jobIds) => {
    const completed = new Set()
    let lastStage = ''

    return new Promise((resolve) => {
      const poll = setInterval(async () => {
        for (const jid of jobIds) {
          if (completed.has(jid)) continue
          try {
            const pr = await fetch(`${API_BASE}/import/progress/${jid}`)
            const p = await pr.json()
            const stage = p.stage || 'unknown'

            if (stage === 'done') {
              completed.add(jid)
              const remaining = jobIds.length - completed.size
              set({
                importProgress: {
                  stage: 'downloading',
                  message: `Imported ${completed.size}/${jobIds.length} tracks...`,
                  progress: completed.size / jobIds.length,
                },
              })
            } else if (stage === 'error') {
              completed.add(jid)
            } else if (stage !== lastStage) {
              lastStage = stage
              set({ importProgress: { stage, message: p.message } })
            }
          } catch { }
        }

        if (completed.size === jobIds.length || completed.size + [...jobIds].filter(
          (j) => j === 'error'
        ).length === jobIds.length) {
          clearInterval(poll)
          resolve({ success: completed.size > 0 })
        }
      }, POLL_INTERVAL)
    })
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
        set({ importProgress: null, loading: false })
        await get().fetchQueue()
        return
      }

      if (data.playlist) {
        set({ importProgress: { stage: 'queued', message: `Queuing ${data.total} tracks...` } })
        await get().pollPlaylistImport(data.job_ids || [])
        set({ loading: false, importProgress: null })
        await get().fetchQueue()
        return
      }

      const jobId = data.job_id
      set({ importProgress: { stage: 'resolving', message: `Resolving: ${data.title || url}` } })
      const result = await get().pollSingleImport(jobId)

      if (result.success) {
        set({ loading: false, importProgress: null })
        await get().fetchQueue()
        const { queue, currentIndex } = get()
        if (queue.length > 0 && currentIndex < 0) {
          const nextRes = await get().nextTrack()
          if (nextRes) get().setPlaying(true)
        }
      } else {
        set({ loading: false, error: result.error, importProgress: null })
      }
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

  library: [],
  libraryOpen: false,

  fetchLibrary: async () => {
    try {
      const r = await fetch(`${API_BASE}/library`)
      const data = await r.json()
      set({ library: data.tracks || [] })
    } catch (e) {
      set({ error: e.message })
    }
  },

  removeFromQueue: async (trackId) => {
    try {
      await fetch(`${API_BASE}/queue/${trackId}`, { method: 'DELETE' })
      await get().fetchQueue()
      await get().fetchLibrary()
    } catch (e) {
      set({ error: e.message })
    }
  },

  addToQueue: async (trackId) => {
    try {
      await fetch(`${API_BASE}/queue/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_id: trackId }),
      })
      await get().fetchQueue()
      await get().fetchLibrary()
    } catch (e) {
      set({ error: e.message })
    }
  },

  removeFromLibrary: async (trackId) => {
    try {
      await fetch(`${API_BASE}/library/${trackId}`, { method: 'DELETE' })
      await get().fetchQueue()
      await get().fetchLibrary()
    } catch (e) {
      set({ error: e.message })
    }
  },

  clearCache: async () => {
    try {
      await fetch(`${API_BASE}/cache/clear`, { method: 'POST' })
      set({ queue: [], currentIndex: -1, library: [] })
    } catch (e) {
      set({ error: e.message })
    }
  },

  setPlaying: (v) => set({ isPlaying: v }),
  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
}))
