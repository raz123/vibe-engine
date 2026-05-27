# Vibe Engine

**An autonomous AI DJ that ingests music from YouTube, analyzes every track for BPM, key, energy, and mood, then auto-mixes them with emotionally smooth transitions.**

Not a playlist player. An autonomous vibe engine.

## Goal

Build an AI DJ that feels like:

- An infinite DJ set that never repeats the same transition twice
- Spotify AI DJ + nightclub-quality crossfades
- Emotionally adaptive radio that reads the room

You paste a YouTube URL (or a playlist), and the engine handles the rest — download, analyze, queue, transition, repeat. The only controls you need are play, vibe mode, and maybe skip.

## Core Principles

1. Transition quality > UI. The transition engine (crossfade, EQ blend, drum carry, vocal swap, drop transition) is the product.
2. Song selection > transition effects. The queue planner optimizes for BPM compatibility, Camelot key matching, energy continuity, and mood flow.
3. No dead air, no vocal collisions, no off-beat cuts.
4. Make the user feel: *"this thing understands the vibe."*

## Architecture (MVP)

| Layer | Stack |
|-------|-------|
| Frontend | React 18 + Vite + Tailwind + Zustand |
| Backend | Python + FastAPI + librosa |
| Audio Extraction | yt-dlp + FFmpeg |
| Analysis | librosa (BPM, key, energy, mood, structure) |
| Transition Engine | 6 types, scored 0-100 per pair |
| Persistence | JSON file in cache directory |

## Test Suite

| Test | Tool | What it checks |
|------|------|----------------|
| `test_frontend.py` | httpx | All assets return HTTP 200 |
| `test_browser.cjs` | Playwright | Page loads with 0 JS errors |
| `test_functional.cjs` | Playwright | Full workflow: import -> play -> crossfade -> verify |

Run: `node test_browser.cjs` or `node test_functional.cjs` from the repo root.

## Usage

```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8765
# Open http://localhost:8765
```

Or double-click `start.bat`.

## Milestones

1. Basic playback + crossfade
2. BPM + key-aware transitions
3. Phrase-aware transitions (entry/exit points)
4. Stem-separated smart transitions (Demucs)
5. AI emotional queue planning
