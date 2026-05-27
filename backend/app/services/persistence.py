import json
import threading
from pathlib import Path
from ..models.schemas import Track, TrackAnalysis, VibeMode
from ..config import CACHE_DIR

STATE_FILE = CACHE_DIR / "session_state.json"
_save_lock = threading.Lock()


def serialize_session(session) -> dict:
    tracks_data = {}
    for tid, track in session.tracks.items():
        t = track.model_dump()
        if track.analysis:
            t["analysis"] = track.analysis.model_dump()
        tracks_data[tid] = t

    return {
        "tracks": tracks_data,
        "queue": list(session.queue),
        "current_index": session.current_index,
        "vibe_mode": session.vibe_mode.value if hasattr(session.vibe_mode, "value") else str(session.vibe_mode),
        "liked_tracks": list(session.liked_tracks),
        "skipped_tracks": list(session.skipped_tracks),
    }


def deserialize_session(data: dict, session, planner):
    tracks = {}
    for tid, tdata in data.get("tracks", {}).items():
        analysis_data = tdata.pop("analysis", None)
        track = Track(**tdata)
        if analysis_data:
            track.analysis = TrackAnalysis(**analysis_data)
        tracks[tid] = track

    session.tracks = tracks
    session.queue = list(data.get("queue", []))
    session.current_index = data.get("current_index", -1)

    vibe_raw = data.get("vibe_mode", "club")
    try:
        session.vibe_mode = VibeMode(vibe_raw)
    except ValueError:
        session.vibe_mode = VibeMode.CLUB

    session.liked_tracks = set(data.get("liked_tracks", []))
    session.skipped_tracks = set(data.get("skipped_tracks", []))


def save_session(session):
    try:
        data = serialize_session(session)
        with _save_lock:
            STATE_FILE.write_text(json.dumps(data, indent=2, default=str))
    except Exception as e:
        print(f"Failed to save session: {e}")


def load_session(session, planner):
    if not STATE_FILE.exists():
        return False
    try:
        data = json.loads(STATE_FILE.read_text())
        deserialize_session(data, session, planner)
        return True
    except Exception as e:
        print(f"Failed to load session: {e}")
        return False
