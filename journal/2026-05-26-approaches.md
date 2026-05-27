# Architecture Approaches — 2026-05-26

## Approach A: Pre-process Monolith (The Academic Stack)

```
yt-dlp → FFmpeg → Demucs → librosa/Essentia → PostgreSQL → FastAPI → React/Electron
                  (full stems)   (full analysis)
```

All heavy work happens at import time. Tracks + stems + metadata cached locally. Real-time is just mixing pre-computed data.

**Pros:** Highest transition quality (all 6 types available), no GPU needed during playback, smooth real-time performance  
**Cons:** Minutes-long import per track (~30-60s stem separation), huge storage (~50MB stems per track + audio), complex pipeline to wire up, slow initial library building

**Ratings:**
- Time to MVP: 2/10
- Transition quality: 10/10
- GPU dependency: Required at import
- Complexity: 9/10
- User experience: Delayed gratification

---

## Approach B: Streaming Lightweight (The Web-Native MVP)

```
yt-dlp → FFmpeg → librosa (fast analysis) → in-memory state → FastAPI → Web Audio API
                  (no stems, BPM/key only)
```

Skip Demucs entirely. Use `librosa` for fast BPM/key (~2s per track). Transitions limited to crossfade and EQ blend via Web Audio API. No caching of audio — stream from YouTube on demand.

**Pros:** Can ship in days, zero GPU needed, minimal storage, works in browser too  
**Cons:** Vocal collisions inevitable, no drum carries or smart swaps, transition quality is basic, feels like a smart playlist not a DJ

**Ratings:**
- Time to MVP: 9/10
- Transition quality: 3/10
- GPU dependency: None
- Complexity: 3/10
- User experience: Functional but unmagical

---

## Approach C: Two-Phase Progressive (The Smart DJ — RECOMMENDED)

```
                    ┌─ Phase 1 (instant): yt-dlp → FFmpeg → librosa (BPM/key/structure/energy)
Queue import ───────┤
                    └─ Phase 2 (background): Demucs → stem cache → refine transition graph
                                              (async, GPU, when idle)
```

Two-tier processing pipeline. Phase 1 analysis is fast (~2-5s per track) — enough for BPM, key, structure, energy, mood. Phase 2 async runs Demucs in background for stem separation.

Transition engine is adaptive: uses stems if available (vocal swap, drum carry), falls back to EQ blends / crossfades if not. Queue already optimized from Phase 1 data.

**Why it wins:**
- **Press play within seconds of importing a YouTube URL** — no waiting for stems
- **Transitions improve organically** as background processing completes
- **Graceful degradation** — every track eventually gets full treatment
- **Incremental GPU usage** — never blocks the UI
- **Best demo story:** "Add a track, it plays well. Wait 2 minutes, it plays *magically*."

**Ratings:**
- Time to MVP: 7/10
- Transition quality: 8/10 (ramps to 10/10)
- GPU dependency: Optional, async
- Complexity: 6/10
- User experience: Instant with progressive magic

---

## Comparison Table

| Criterion | A: Monolith | B: Lightweight | C: Progressive |
|-----------|:-----------:|:--------------:|:--------------:|
| Time to MVP | 2 | 9 | 7 |
| Transition quality | 10 | 3 | 8 → 10 |
| GPU necessity | Hard | None | Soft |
| Storage cost | High | Low | Medium |
| Architectural risk | High | Low | Medium |
| "How did it know?" moments | High | Low | High |
| User patience required | High | None | Low |

---

## Recommendation: Approach C (Progressive Two-Phase)

**Rationale:** The biggest risk is building too much before the user can feel anything. Approach C gives you a working, impressive MVP in days, then silently upgrades itself into a world-class system. It aligns with the stated principle *"Transition quality matters more than UI"* while also respecting *"avoid dead air at all costs"* — because dead air during stem processing is the exact failure mode of Approach A.

### Suggested Phase C.1 build order:
1. **yt-dlp + FFmpeg stream + librosa BPM/key** — get a track playing with crossfade
2. **Energy/mood vectors + queue optimization** — make song selection intelligent
3. **Structure detection (intro/outro/chorus)** — enable phrase-aligned crossfades
4. **Async Demucs pipeline + stem cache** — unlock advanced transitions as tracks finish
5. **Adaptive transition selector** — picks best transition given available data
