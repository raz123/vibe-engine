import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '../stores/useStore'
import Visualizer from './Visualizer'

const API_BASE = ''
const DBG = (...args) => console.log('[Player]', ...args)

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function setupAudioGraph(ctx) {
  const master = ctx.createGain()
  master.gain.value = 1
  master.connect(ctx.destination)
  const gainA = ctx.createGain(); gainA.gain.value = 1; gainA.connect(master)
  const gainB = ctx.createGain(); gainB.gain.value = 0; gainB.connect(master)
  DBG('audio graph created')
  return { master, gainA, gainB }
}

let ctxSingleton = null
let graphSingleton = null
function getAudioCtx() {
  if (!ctxSingleton) {
    ctxSingleton = new (window.AudioContext || window.webkitAudioContext)()
    graphSingleton = setupAudioGraph(ctxSingleton)
  }
  return { ctx: ctxSingleton, ...graphSingleton }
}

function loadAudioBuffer(ctx, url) {
  DBG('loading buffer:', url.slice(-30))
  return fetch(url).then((r) => r.arrayBuffer()).then((buf) => ctx.decodeAudioData(buf))
}

export default function Player() {
  const [crossfading, setCrossfading] = useState(false)
  const [nextTrackInfo, setNextTrackInfo] = useState(null)
  const [currentBuffer, setCurrentBuffer] = useState(null)

  const sourceARef = useRef(null)
  const sourceBRef = useRef(null)
  const activeRef = useRef(0)
  const crossfadingRef = useRef(false)
  const pausedRef = useRef(false)
  const nextTrackDataRef = useRef(null)
  const currentBufferRef = useRef(null)
  const nextBufferRef = useRef(null)
  const currentTrackIdRef = useRef(null)
  const startTimeRef = useRef(0)
  const offsetRef = useRef(0)
  const timerRef = useRef(null)
  const advanceFnRef = useRef(null)

  const {
    queue, currentIndex, isPlaying, transition,
    setPlaying, setCurrentTime, setDuration,
    nextTrack, fetchQueue, getTransitionPlan,
  } = useStore()

  const current = queue[currentIndex]

  useEffect(() => { fetchQueue() }, [])

  const stopSource = useCallback((srcRef, label = '') => {
    if (srcRef.current) DBG('stopSource', label)
    try { srcRef.current?.stop() } catch {}
    try { srcRef.current?.disconnect() } catch {}
    srcRef.current = null
  }, [])

  const playBuffer = useCallback((buffer, gainNode, offset = 0, when = 0) => {
    const { ctx } = getAudioCtx()
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(gainNode)
    src.start(when, offset)
    DBG('playBuffer offset=', offset, 'when=', when)
    return src
  }, [])

  const scheduleCrossfadeEnd = useCallback((durationMs) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    DBG('scheduleCrossfadeEnd in', durationMs, 'ms')
    timerRef.current = setTimeout(() => {
      stopSource(activeRef.current === 0 ? sourceARef : sourceBRef, 'old-active')
      const { gainA, gainB } = getAudioCtx()
      gainA.gain.value = 1
      gainB.gain.value = 0
      activeRef.current = activeRef.current === 0 ? 1 : 0
      crossfadingRef.current = false
      setCrossfading(false)
      setNextTrackInfo(null)
      offsetRef.current = 0
      startTimeRef.current = getAudioCtx().ctx.currentTime
      nextTrackDataRef.current = null
      nextBufferRef.current = null
      timerRef.current = null
      DBG('crossfade complete, activeRef=', activeRef.current)

      fetchQueue().then(() => {
        getTransitionPlan()
        if (!pausedRef.current) setPlaying(true)
      })
    }, durationMs + 200)
  }, [fetchQueue, getTransitionPlan, setPlaying, stopSource])

  const beginCrossfade = useCallback(() => {
    if (crossfadingRef.current) { DBG('beginCrossfade skipped — already crossfading'); return }
    const nextData = nextTrackDataRef.current
    if (!nextData) { DBG('beginCrossfade skipped — no nextData'); return }

    const duration = nextData.transition?.crossfade_duration || 4
    const entryOffset = nextData.transition?.timestamp_in || 0
    const now = getAudioCtx().ctx.currentTime
    const nextBuf = nextBufferRef.current
    if (!nextBuf) { DBG('beginCrossfade skipped — no nextBuf'); return }

    crossfadingRef.current = true
    setCrossfading(true)
    setNextTrackInfo(nextData.track)
    DBG('beginCrossfade type=', nextData.transition?.transition_type, 'duration=', duration, 'entry=', entryOffset)

    const idleGain = activeRef.current === 0 ? getAudioCtx().gainB : getAudioCtx().gainA
    const activeGain = activeRef.current === 0 ? getAudioCtx().gainA : getAudioCtx().gainB
    const idleSrcRef = activeRef.current === 0 ? sourceBRef : sourceARef

    idleGain.gain.setValueAtTime(0, now)
    const src = playBuffer(nextBuf, idleGain, entryOffset, now)
    idleSrcRef.current = src

    idleGain.gain.linearRampToValueAtTime(1, now + duration)
    activeGain.gain.linearRampToValueAtTime(0, now + duration)

    scheduleCrossfadeEnd(duration * 1000)
  }, [playBuffer, scheduleCrossfadeEnd])

  const loadTrackInternal = useCallback(async (trackId) => {
    currentTrackIdRef.current = trackId
    const { ctx } = getAudioCtx()
    if (!pausedRef.current) await tryResumeCtx()

    const url = `${API_BASE}/track/${trackId}/audio`
    const buffer = await loadAudioBuffer(ctx, url)
    if (currentTrackIdRef.current !== trackId) { DBG('loadTrackInternal stale, abort'); return }
    currentBufferRef.current = buffer
    setCurrentBuffer(buffer)
    setDuration(buffer.duration)

    if (currentTrackIdRef.current === trackId) {
      const now = ctx.currentTime
      const gain = activeRef.current === 0 ? getAudioCtx().gainA : getAudioCtx().gainB
      stopSource(activeRef.current === 0 ? sourceARef : sourceBRef, 'loadTrack')
      const src = playBuffer(buffer, gain)
      src.onended = () => {
        DBG('source.onended fired')
        if (!crossfadingRef.current && advanceFnRef.current && !pausedRef.current) {
          advanceFnRef.current()
        }
      }
      if (activeRef.current === 0) sourceARef.current = src
      else sourceBRef.current = src

      startTimeRef.current = now
      offsetRef.current = 0
      DBG('loadTrackInternal done, started playback')
    }
  }, [playBuffer, stopSource, setDuration, tryResumeCtx])

  const handleManualCrossfade = useCallback(async () => {
    if (crossfadingRef.current) { DBG('handleManualCrossfade skipped — crossfading'); return }
    if (!current) { DBG('handleManualCrossfade skipped — no current'); return }
    DBG('handleManualCrossfade start')
    const data = await nextTrack()
    if (!data) { DBG('handleManualCrossfade — nextTrack returned null'); return }
    nextTrackDataRef.current = data
    await tryResumeCtx()
    const url = `${API_BASE}/track/${data.track.id}/audio`
    const buf = await loadAudioBuffer(ctx, url)
    nextBufferRef.current = buf
    beginCrossfade()
  }, [current, nextTrack, beginCrossfade, tryResumeCtx])

  useEffect(() => {
    if (!current) return
    if (currentTrackIdRef.current !== current.track.id && !crossfadingRef.current) {
      DBG('track changed to:', current.track.id)
      getTransitionPlan()
      loadTrackInternal(current.track.id)
    }
  }, [current?.track?.id, loadTrackInternal, getTransitionPlan])

  // Proper pause/resume via AudioContext
  const tryResumeCtx = useCallback(async () => {
    const ctx = getAudioCtx().ctx
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
        DBG('AudioContext resumed')
        return true
      } catch (e) {
        DBG('AudioContext resume failed (autoplay policy):', e)
        return false
      }
    }
    return true
  }, [])

  const trySuspendCtx = useCallback(async () => {
    const ctx = getAudioCtx().ctx
    if (ctx.state === 'running') {
      await ctx.suspend()
      DBG('AudioContext suspended')
    }
  }, [])

  const togglePlay = useCallback(async () => {
    const ctx = getAudioCtx().ctx
    if (ctx.state === 'running') {
      pausedRef.current = true
      await trySuspendCtx()
      setPlaying(false)
    } else {
      pausedRef.current = false
      const ok = await tryResumeCtx()
      if (ok) setPlaying(true)
    }
  }, [tryResumeCtx, trySuspendCtx, setPlaying])

  const handleSkip = useCallback(async () => {
    if (crossfadingRef.current) { DBG('handleSkip skipped — crossfading'); return }
    await handleManualCrossfade()
  }, [handleManualCrossfade])

  const handleAdvance = useCallback(async () => {
    if (crossfadingRef.current) { DBG('handleAdvance skipped — crossfading'); return }
    if (pausedRef.current) { DBG('handleAdvance skipped — paused'); return }
    DBG('handleAdvance start (track ended)')
    const data = await nextTrack()
    if (!data) { DBG('handleAdvance — nextTrack returned null'); return }
    nextTrackDataRef.current = data
    await tryResumeCtx()
    const { ctx } = getAudioCtx()
    const url = `${API_BASE}/track/${data.track.id}/audio`
    const buf = await loadAudioBuffer(ctx, url)
    nextBufferRef.current = buf
    beginCrossfade()
  }, [nextTrack, beginCrossfade, tryResumeCtx])
  advanceFnRef.current = handleAdvance

  const hasNext = currentIndex < queue.length - 1 || queue.length > 1

  // RAF time tracking — works even when suspended (time freezes)
  useEffect(() => {
    if (!isPlaying || !currentBuffer) return
    let raf
    const tick = () => {
      if (crossfadingRef.current) { raf = requestAnimationFrame(tick); return }
      const elapsed = offsetRef.current + (getAudioCtx().ctx.currentTime - startTimeRef.current)
      if (elapsed >= 0 && elapsed < (currentBuffer?.duration || 0)) {
        setCurrentTime(elapsed)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying, currentBuffer, setCurrentTime])

  const handleSeek = useCallback((e) => {
    const t = parseFloat(e.target.value)
    if (isNaN(t)) return
    offsetRef.current = t
    startTimeRef.current = getAudioCtx().ctx.currentTime
    if (crossfadingRef.current) return
    stopSource(activeRef.current === 0 ? sourceARef : sourceBRef, 'seek')
    if (currentBufferRef.current) {
      const gain = activeRef.current === 0 ? getAudioCtx().gainA : getAudioCtx().gainB
      const src = playBuffer(currentBufferRef.current, gain, t)
      if (activeRef.current === 0) sourceARef.current = src
      else sourceBRef.current = src
      setCurrentTime(t)
    }
  }, [playBuffer, stopSource, setCurrentTime])

  if (!current) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 gap-4 text-gray-500">
        <div className="text-6xl opacity-30">🎵</div>
        <p className="text-lg">Import a track to start the vibe</p>
      </div>
    )
  }

  const a = current.track.analysis
  const duration = currentBuffer?.duration || 0
  const seekTime = (() => {
    if (crossfadingRef.current) return 0
    const t = offsetRef.current + (getAudioCtx().ctx.currentTime - startTimeRef.current)
    return t >= 0 && t < duration ? t : 0
  })()

  return (
    <div className="card space-y-4">
      <Visualizer crossfading={crossfading} />

      <div className="text-center space-y-1 min-h-[3rem]">
        {crossfading && nextTrackInfo ? (
          <>
            <p className="text-xs text-vibe-400 font-medium animate-pulse">
              Crossfading: {transition?.transition_type || 'crossfade'}
            </p>
            <h2 className="text-xl font-semibold truncate text-vibe-300">{nextTrackInfo.title}</h2>
            <p className="text-sm text-gray-500 truncate">{nextTrackInfo.artist}</p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold truncate">{current.track.title}</h2>
            <p className="text-sm text-gray-400 truncate">{current.track.artist}</p>
          </>
        )}
      </div>

      {a && !crossfading && (
        <div className="flex flex-wrap justify-center gap-2 text-xs">
          <span className="chip bg-vibe-900/50 text-vibe-300">{a.bpm.toFixed(0)} BPM</span>
          <span className="chip bg-blue-900/50 text-blue-300">{a.key} ({a.key_camelot})</span>
          <span className="chip bg-purple-900/50 text-purple-300">{(a.energy * 100).toFixed(0)}% Energy</span>
          {a.mood.map((m) => (
            <span key={m} className="chip bg-amber-900/50 text-amber-300">{m}</span>
          ))}
        </div>
      )}

      {transition && !crossfading && !nextTrackInfo && (
        <div className="text-center text-xs text-gray-500">
          Up next: <span className="text-vibe-400 font-medium">{transition.transition_type}</span>
          {' \u00B7 '}{transition.crossfade_duration}s crossfade
          {transition.timestamp_in > 0 && ' \u00B7 entry at ' + formatTime(transition.timestamp_in)}
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-10 text-right">{formatTime(seekTime)}</span>
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={seekTime}
          onChange={handleSeek}
          className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        <span className="text-xs text-gray-500 w-10">{formatTime(duration)}</span>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button onClick={handleSkip} disabled={!hasNext || crossfading} className="btn-ghost disabled:opacity-30" title="Skip back">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6l8.5 6L6 18V6zM16 6v12h2V6h-2z"/></svg>
        </button>
        <button
          onClick={togglePlay}
          className="w-14 h-14 flex items-center justify-center bg-vibe-600 hover:bg-vibe-500 rounded-full transition-colors"
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
          ) : (
            <svg className="w-6 h-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>
        <button onClick={handleSkip} disabled={!hasNext || crossfading} className="btn-ghost disabled:opacity-30" title="Skip + crossfade">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
        </button>
      </div>

      {hasNext && !crossfading && (
        <div className="flex justify-center pt-1">
          <button
            onClick={handleManualCrossfade}
            className="px-4 py-1.5 text-xs font-medium text-vibe-300 border border-vibe-800 hover:bg-vibe-900/30 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Crossfade Now
          </button>
        </div>
      )}
    </div>
  )
}
