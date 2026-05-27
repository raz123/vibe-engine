import threading
import time
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .models.schemas import (
    ImportRequest, ImportResponse, Track, TrackAnalysis,
    QueueResponse, QueueItem, TransitionPlan, VibeChangeRequest, VibeMode,
)
from .audio.extractor import extract_track_info, extract_playlist_entries, is_playlist_url, download_audio, get_audio_duration
from .audio.analyzer import analyze_track
from .audio.transition import plan_transition
from .services.queue import session, planner
from .services.persistence import save_session, load_session
from .config import CACHE_DIR

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("vibe")

app = FastAPI(title="Vibe Engine API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request, call_next):
    log.info("%s %s", request.method, request.url.path)
    response = await call_next(request)
    if response.status_code >= 400:
        log.warning("%s %s -> %s", request.method, request.url.path, response.status_code)
    return response

save_state = lambda: save_session(session)

restored = load_session(session, planner)
if restored:
    log.info("Session restored: %d tracks, %d queued", len(session.tracks), len(session.queue))
else:
    log.info("Fresh session started")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


import_progress_store = {}
import_progress_lock = threading.Lock()


def set_progress(track_id: str, stage: str, message: str):
    with import_progress_lock:
        import_progress_store[track_id] = {"stage": stage, "message": message, "updated_at": time.time()}


def run_import(url: str, track_id: str, info: dict, title: str, artist: str):
    log.info("Import start: id=%s title=%s", track_id, title)
    try:
        set_progress(track_id, "downloading", "Downloading audio from YouTube...")
        wav_path = download_audio(url, track_id, progress_cb=lambda s, m: set_progress(track_id, s, m))

        set_progress(track_id, "analyzing", "Analyzing track (BPM, key, energy)...")
        analysis_data = analyze_track(wav_path, progress_cb=lambda s, m: set_progress(track_id, s, m))

        duration = get_audio_duration(wav_path)

        analysis = TrackAnalysis(
            track_id=track_id,
            title=title,
            artist=artist,
            duration=duration,
            bpm=analysis_data["bpm"],
            bpm_confidence=analysis_data["bpm_confidence"],
            key=analysis_data["key"],
            key_camelot=analysis_data["key_camelot"],
            energy=analysis_data["energy"],
            danceability=analysis_data["danceability"],
            mood=analysis_data["mood"],
            structure=analysis_data["structure"],
            loudness=analysis_data["loudness"],
        )

        track = Track(
            id=track_id,
            url=url,
            title=analysis.title,
            artist=analysis.artist,
            duration=duration,
            file_path=str(wav_path),
            analysis=analysis,
            stems_available=False,
        )

        planner.add_track(track)

        if len(session.queue) >= 2:
            planner.optimize_queue()

        save_state()
        set_progress(track_id, "done", "Import complete")
        log.info("Import done: id=%s queue=%d tracks", track_id, len(session.queue))

    except Exception as e:
        log.error("Import failed: id=%s error=%s", track_id, e)
        set_progress(track_id, "error", f"Import failed: {e}")


@app.post("/import")
async def import_track(req: ImportRequest):
    playlist = is_playlist_url(req.url)

    if playlist:
        try:
            entries = extract_playlist_entries(req.url)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to extract playlist: {e}")

        if not entries:
            raise HTTPException(status_code=400, detail="No videos found in playlist")

        job_ids = []
        for entry in entries:
            tid = entry["id"]
            if tid in session.tracks:
                continue
            set_progress(tid, "queued", f"Queued: {entry['title']}")
            thread = threading.Thread(
                target=run_import,
                args=(entry["url"], tid, entry, entry["title"], entry["uploader"]),
                daemon=True,
            )
            thread.start()
            job_ids.append(tid)

        return {
            "status": "started",
            "playlist": True,
            "total": len(entries),
            "job_ids": job_ids,
            "title": f"Playlist ({len(entries)} tracks)",
        }

    try:
        track_id, info = extract_track_info(req.url)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract info: {e}")

    title = info.get("title", "Unknown")
    artist = info.get("uploader", "Unknown") or info.get("channel", "Unknown")

    if track_id in session.tracks:
        track = session.tracks[track_id]
        return {"track": track, "status": "already_cached", "job_id": track_id}

    set_progress(track_id, "resolving", "Resolving track info...")
    set_progress(track_id, "resolved", f"Found: {title}")

    thread = threading.Thread(target=run_import, args=(req.url, track_id, info, title, artist), daemon=True)
    thread.start()

    return {"status": "started", "job_id": track_id, "title": title, "artist": artist}


@app.get("/import/progress/{job_id}")
async def get_import_progress(job_id: str):
    with import_progress_lock:
        progress = import_progress_store.get(job_id)
    if not progress:
        if job_id in session.tracks:
            return {"stage": "done", "message": "Import complete", "track_id": job_id}
        return {"stage": "unknown", "message": "No import job found with that ID"}
    result = dict(progress)
    if progress["stage"] == "done" and job_id in session.tracks:
        track = session.tracks[job_id]
        result["track"] = track
    return result


@app.get("/library")
async def get_library():
    items = []
    for tid, track in session.tracks.items():
        in_queue = tid in session.queue
        items.append({"track": track, "in_queue": in_queue})
    return {"tracks": items, "total": len(items)}


@app.delete("/library/{track_id}")
async def remove_from_library(track_id: str):
    planner.remove_track(track_id)
    save_state()
    return {"status": "removed"}


@app.get("/queue", response_model=QueueResponse)
async def get_queue():
    items = []
    for i, tid in enumerate(session.queue):
        track = session.tracks.get(tid)
        if track:
            transition = TransitionPlan(
                transition_type="crossfade",
                crossfade_duration=4.0,
                timestamp_in=0,
                timestamp_out=0,
            )
            items.append(QueueItem(track=track, position=i, transition_type=transition.transition_type))
    return QueueResponse(
        queue=items,
        current_index=session.current_index,
        vibe_mode=session.vibe_mode,
    )


@app.post("/queue/next")
async def next_track():
    tid = planner.get_next()
    if not tid:
        raise HTTPException(status_code=404, detail="No tracks in queue")
    track = session.tracks.get(tid)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    current_tid = planner.get_current()
    transition = TransitionPlan(transition_type="crossfade", crossfade_duration=4.0, timestamp_in=0, timestamp_out=0)

    if current_tid and track.analysis:
        current_track = session.tracks.get(current_tid)
        if current_track and current_track.analysis:
            trans = plan_transition(
                current_track.analysis.model_dump(),
                track.analysis.model_dump(),
                stems_available=track.stems_available,
            )
            transition = TransitionPlan(
                transition_type=trans["transition_type"],
                crossfade_duration=trans["crossfade_duration"],
                eq_settings=trans["eq_settings"],
                timestamp_in=trans["timestamp_in"],
                timestamp_out=trans["timestamp_out"],
            )

    log.info("queue/next: index now=%d track=%s transition=%s",
             session.current_index, tid, transition.transition_type)
    return {"track": track, "transition": transition}


@app.post("/queue/advance")
async def advance_queue():
    tid = planner.advance()
    if not tid:
        raise HTTPException(status_code=404, detail="No tracks in queue")
    track = session.tracks.get(tid)
    save_state()
    return {"track": track}


@app.get("/track/{track_id}/audio")
async def stream_audio(track_id: str):
    track = session.tracks.get(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    file_path = Path(track.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(str(file_path), media_type="audio/wav")


@app.get("/track/{track_id}")
async def get_track(track_id: str):
    track = session.tracks.get(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    return track


@app.post("/tracks/{track_id}/like")
async def like_track(track_id: str):
    session.liked_tracks.add(track_id)
    session.skipped_tracks.discard(track_id)
    save_state()
    return {"status": "liked"}


@app.post("/tracks/{track_id}/skip")
async def skip_track(track_id: str):
    session.skipped_tracks.add(track_id)
    session.liked_tracks.discard(track_id)
    tid = planner.advance()
    if not tid:
        raise HTTPException(status_code=404, detail="No tracks in queue")
    track = session.tracks.get(tid)
    save_state()
    return {"track": track}


@app.get("/transition/plan")
async def get_transition_plan():
    current_tid = planner.get_current()
    if not current_tid:
        return {"transition": None, "score": 0, "reasons": []}
    next_idx = session.current_index + 1
    if next_idx >= len(session.queue):
        return {"transition": None, "score": 0, "reasons": []}

    next_tid = session.queue[next_idx]
    current_track = session.tracks.get(current_tid)
    next_track = session.tracks.get(next_tid)

    if not current_track or not next_track or not current_track.analysis or not next_track.analysis:
        return {
            "transition": TransitionPlan(
                transition_type="crossfade", crossfade_duration=4.0, timestamp_in=0, timestamp_out=0,
            )
        }

    trans = plan_transition(
        current_track.analysis.model_dump(),
        next_track.analysis.model_dump(),
        stems_available=next_track.stems_available,
    )
    return {
        "transition": TransitionPlan(
            transition_type=trans["transition_type"],
            crossfade_duration=trans["crossfade_duration"],
            eq_settings=trans["eq_settings"],
            timestamp_in=trans["timestamp_in"],
            timestamp_out=trans["timestamp_out"],
        ),
        "score": trans["score"],
        "reasons": trans["reasons"],
    }


@app.post("/vibe", response_model=VibeChangeRequest)
async def set_vibe(req: VibeChangeRequest):
    session.set_vibe_mode(req.mode)
    save_state()
    return req


@app.get("/vibe")
async def get_vibe():
    return {"mode": session.vibe_mode, "params": session.get_vibe_params()}


@app.post("/queue/reorder")
async def reorder_queue(track_ids: list[str]):
    planner.reorder(track_ids)
    save_state()
    return {"status": "reordered"}


@app.post("/queue/add")
async def add_to_queue(data: dict):
    track_id = data.get("track_id", "")
    if not track_id or track_id not in session.tracks:
        raise HTTPException(status_code=404, detail="Track not found in library")
    if track_id in session.queue:
        return {"status": "already_in_queue"}
    session.queue.append(track_id)
    save_state()
    return {"status": "added"}


@app.delete("/queue/{track_id}")
async def remove_from_queue(track_id: str):
    if track_id in session.queue:
        session.queue.remove(track_id)
    save_state()
    return {"status": "removed_from_queue"}


@app.get("/cache/stats")
async def cache_stats():
    total_size = sum(f.stat().st_size for f in CACHE_DIR.rglob("*") if f.is_file())
    file_count = sum(1 for f in CACHE_DIR.rglob("*") if f.is_file())
    return {
        "size_bytes": total_size,
        "size_mb": round(total_size / (1024 * 1024), 2),
        "file_count": file_count,
        "track_count": len(session.tracks),
        "queue_length": len(session.queue),
    }


@app.post("/cache/clear")
async def clear_cache():
    for d in [CACHE_DIR / "audio", CACHE_DIR / "analysis"]:
        if d.exists():
            for f in d.iterdir():
                if f.is_file():
                    f.unlink()
    state_file = CACHE_DIR / "session_state.json"
    if state_file.exists():
        state_file.unlink()
    return {"status": "cleared"}


FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
