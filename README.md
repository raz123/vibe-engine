# Vibe Engine

**An autonomous AI DJ that ingests YouTube music, analyzes tracks in real-time, and generates emotionally smooth auto-mixed playlists.**

Not a playlist player. An autonomous vibe engine.

---

## Quick Start

### Prerequisites

- **Python 3.10+** with `pip`
- **Node.js 18+** with `npm`
- **FFmpeg** (install via `winget install FFmpeg` or download from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/))
- **yt-dlp** (installed automatically with Python deps)

### Install

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
npm run build     # build static files for backend to serve
```

### Configure

Edit `backend/app/config.py` to set your FFmpeg paths:

```python
FFMPEG_PATH = r"C:\path\to\ffmpeg.exe"
FFPROBE_PATH = r"C:\path\to\ffprobe.exe"
```

### Run

```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8765
```

Open `http://localhost:8765` in your browser.

### Usage

1. Paste a YouTube URL into the import bar
2. Track is downloaded, analyzed (BPM, key, energy, mood), and added to queue
3. Press play — the engine handles transitions automatically
4. Adjust vibe mode (Club, Chill, Euphoric, etc.) to change the energy curve

---

## Architecture

```
┌──────────────┐     ┌─────────────────────────────────────┐     ┌──────────────┐
│  YouTube URL │────▶│          Backend (FastAPI)           │────▶│  Frontend    │
│  Search/Play │     │                                     │     │  (React +    │
└──────────────┘     │  ┌─────────┐  ┌──────────┐         │     │   Tailwind)  │
                     │  │ yt-dlp  │─▶│ librosa  │         │     │              │
                     │  │ + FFmpeg│  │ Analysis │         │     │  ┌─────────┐│
                     │  └─────────┘  └──────────┘         │     │  │ Player  ││
                     │       │              │              │     │  │ Queue   ││
                     │       ▼              ▼              │     │  │ Vibe    ││
                     │  ┌─────────┐  ┌──────────┐         │     │  │ Visual  ││
                     │  │ WAV     │  │ Analysis │         │     │  └─────────┘│
                     │  │ Cache   │  │ Cache    │         │     └──────────────┘
                     │  └─────────┘  └──────────┘         │
                     │                                     │
                     │  ┌──────────────────────────┐      │
                     │  │    Transition Engine      │      │
                     │  │  ┌──────────────────────┐ │      │
                     │  │  │ • Crossfade           │ │      │
                     │  │  │ • EQ Blend            │ │      │
                     │  │  │ • Drum Carry          │ │      │
                     │  │  │ • Vocal Swap          │ │      │
                     │  │  │ • Drop Transition     │ │      │
                     │  │  │ • Echo/Reverb Exit    │ │      │
                     │  │  └──────────────────────┘ │      │
                     │  └──────────────────────────┘      │
                     │                                     │
                     │  ┌──────────────────────────┐      │
                     │  │    Queue Planner          │      │
                     │  │  • Energy graph           │      │
                     │  │  • Mood continuity        │      │
                     │  │  • Key compatibility      │      │
                     │  │  • BPM matching           │      │
                     │  └──────────────────────────┘      │
                     └─────────────────────────────────────┘
```

### Three-Phase Processing

| Phase | What | Time | Trigger |
|-------|------|------|---------|
| 1. Extract | yt-dlp download → FFmpeg to WAV | ~2s | On import |
| 1b. Analyze | librosa: BPM, key, energy, mood, structure | ~9s | On import |
| 2. Queue | Optimize order via transition scores | instant | On queue change |
| 3. Transition | Plan transition between current and next track | instant | On track change |

---

## Audio Analysis

Per track, the engine computes:

| Feature | Method | Used For |
|---------|--------|----------|
| **BPM** | librosa beat tracking | Transition timing, queue ordering |
| **Musical Key** | Chroma CQT + Krumhansl profiles | Camelot wheel compatibility |
| **Energy** | RMS + spectral centroid + zero-crossing | Mood classification, energy curve |
| **Danceability** | Composite of energy + BPM proximity + density | Vibe scoring |
| **Mood Tags** | Rule-based classifier from BPM/energy/brightness | Vibe continuity |
| **Structure** | Beat-aligned intro/outro detection | Phrase-aligned transitions |

### Mood Tags

- `chill` — BPM < 90, low energy
- `ambient` — BPM < 80, very low energy
- `hype` — BPM > 120, high energy
- `aggressive` — Very high energy
- `euphoric` — High brightness + high energy
- `dark` — Low energy + low brightness
- `melodic` — Mid-range BPM and energy (default)

---

## Transition Engine

### Scoring

Transitions are scored 0–100 based on:

| Criterion | Max Points |
|-----------|-----------|
| BPM match (<3 delta) | 30 |
| Camelot key compatibility | 25 |
| Energy similarity | 20 |
| Mood overlap | 15 |
| BPM near-match (<8 delta) | 10 bonus |

### Transition Types

| Type | Score Threshold | Description |
|------|----------------|-------------|
| **Vocal Swap** | >85 | Isolate outgoing vocals while incoming track enters (requires stems) |
| **Drop Transition** | >75 | Time transition to hit during buildup/drop moments |
| **Drum Carry** | >75 | Keep percussion from outgoing track bleeding into incoming |
| **EQ Blend** | >60 | Roll off outgoing highs, boost incoming lows |
| **Crossfade** | >40 | Simple volume crossfade |
| **Echo/Reverb Exit** | <40 | Emergency: send outgoing through echo/reverb wash |

### Hard Constraints

- No key clashes (Camelot adjacent or same)
- No vocal overlap (planned for stem-based phase)
- Beat-aligned transition points
- Phrase-aligned entry/exit

---

## Vibe Modes

| Mode | Energy Curve | Genre Tolerance | Transition Aggression |
|------|-------------|----------------|----------------------|
| Club | Build → Peak | 0.6 | 0.7 |
| Chill | Sustained Low | 0.8 | 0.3 |
| Focus | Flat | 0.4 | 0.2 |
| Late Night | Slow Descent | 0.7 | 0.5 |
| Aggressive | Sustained High | 0.3 | 0.9 |
| Euphoric | Peak Plateau | 0.5 | 0.8 |
| Deep House | Groove Steady | 0.3 | 0.6 |
| Experimental | Random Walk | 1.0 | 0.5 |

---

## API Reference

### `GET /health`
Health check.

### `POST /import`
Import a YouTube URL for analysis and queuing.

```json
{ "url": "https://www.youtube.com/watch?v=..." }
```

Returns `{ "track": { ..., "analysis": { "bpm": ..., "key": ..., "mood": [...] } }, "status": "imported" }`

### `GET /queue`
Returns current queue with analysis for each track.

### `POST /queue/next`
Advance to next track. Returns the track and transition plan.

```json
{
  "track": { ... },
  "transition": {
    "transition_type": "drop_transition",
    "crossfade_duration": 4.0,
    "eq_settings": { ... },
    "timestamp_in": 0,
    "timestamp_out": 0
  }
}
```

### `GET /transition/plan`
Preview the planned transition without advancing.

### `POST /vibe`
```json
{ "mode": "chill" }
```

### `GET /track/{id}/audio`
Stream the WAV audio file for a track.

### `POST /tracks/{id}/like`
### `POST /tracks/{id}/skip`
Feedback loop for the recommendation engine.

### `GET /cache/stats`
Cache usage metrics.

### `POST /cache/clear`
Clear audio and analysis caches.

---

## Future Milestones

### Phase 2 (Next)
- **Stem separation** via Demucs (async background processing)
- **Vocal swap / drum carry** transitions with isolated stems
- **Transition preview** — audition transitions before they play
- **Playlist import** — full YouTube playlists in one click
- **Electron desktop app** — native window with system tray

### Phase 3
- **AI queue planning** with reinforcement learning
- **Session modeling** (warmup → buildup → peak → cooldown)
- **Spotify integration** for metadata + discovery
- **Real-time DSP** via Rubber Band Library

### Phase 4
- **Multi-source input** (local files, SoundCloud)
- **Collaborative queues** (web multiplayer)
- **Mobile companion** (remote control, vote on tracks)

---

## Legal

Vibe Engine does not permanently host or redistribute copyrighted music. All audio is:
- Downloaded temporarily to local cache
- Processed client-side
- User-supplied via YouTube URLs

---

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app + API routes
│   ├── config.py            # Paths, cache limits
│   ├── audio/
│   │   ├── extractor.py     # yt-dlp + FFmpeg pipeline
│   │   ├── analyzer.py      # librosa analysis (BPM, key, energy, mood)
│   │   └── transition.py    # Transition scoring + planning
│   ├── models/
│   │   └── schemas.py       # Pydantic models
│   └── services/
│       └── queue.py         # Queue management + session state
├── cache/                   # Auto-created: audio WAVs + analysis JSON
└── requirements.txt

frontend/
├── src/
│   ├── App.jsx              # Main layout
│   ├── components/
│   │   ├── Player.jsx       # Audio player + controls + waveform
│   │   ├── Queue.jsx        # Track queue display
│   │   ├── VibeControl.jsx  # Vibe mode selector
│   │   ├── ImportBar.jsx    # YouTube URL input
│   │   └── Visualizer.jsx   # Audio visualizer
│   └── stores/
│       └── useStore.js      # Zustand state management
├── public/
│   └── electron.js          # Electron shell
├── dist/                    # Built static files (auto-generated)
└── package.json
```

---

*"Build an autonomous vibe engine, not a playlist player."*
