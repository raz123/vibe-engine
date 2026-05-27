from pydantic import BaseModel
from typing import Optional
from enum import Enum


class VibeMode(str, Enum):
    CLUB = "club"
    CHILL = "chill"
    FOCUS = "focus"
    LATE_NIGHT = "late_night"
    AGGRESSIVE = "aggressive"
    EUPHORIC = "euphoric"
    DEEP_HOUSE = "deep_house"
    EXPERIMENTAL = "experimental"


class TrackAnalysis(BaseModel):
    track_id: str
    title: str
    artist: str
    duration: float
    bpm: float
    bpm_confidence: float
    key: str
    key_camelot: str
    energy: float
    danceability: float
    mood: list[str]
    structure: dict
    loudness: float


class Track(BaseModel):
    id: str
    url: str
    title: str
    artist: str
    duration: float
    file_path: str
    analysis: Optional[TrackAnalysis] = None
    stems_available: bool = False


class QueueItem(BaseModel):
    track: Track
    position: int
    transition_type: str = "crossfade"


class TransitionPlan(BaseModel):
    transition_type: str
    crossfade_duration: float
    eq_settings: dict = {}
    timestamp_in: float
    timestamp_out: float


class ImportRequest(BaseModel):
    url: str


class ImportResponse(BaseModel):
    track: Track
    status: str


class QueueResponse(BaseModel):
    queue: list[QueueItem]
    current_index: int
    vibe_mode: VibeMode = VibeMode.CLUB


class VibeChangeRequest(BaseModel):
    mode: VibeMode
