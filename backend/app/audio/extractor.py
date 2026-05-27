import subprocess
import json
import os
from pathlib import Path
import yt_dlp
from ..config import FFMPEG_PATH, TEMP_DIR, CACHE_DIR, ANALYSIS_CACHE_DIR

AUDIO_CACHE = CACHE_DIR / "audio"
AUDIO_CACHE.mkdir(exist_ok=True)


def extract_track_id(url: str):
    ydl_opts = {"quiet": True, "no_warnings": True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        return info.get("id", ""), info


def download_audio(url: str, track_id: str, progress_cb=None) -> Path:
    output_path = AUDIO_CACHE / f"{track_id}"
    wav_path = output_path.with_suffix(".wav")

    if wav_path.exists():
        if progress_cb:
            progress_cb("cached", "Audio already cached")
        return wav_path

    if progress_cb:
        progress_cb("downloading", "Downloading audio from YouTube...")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": str(output_path) + ".%(ext)s",
        "quiet": True,
        "no_warnings": True,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "wav",
            }
        ],
        "ffmpeg_location": str(FFMPEG_PATH),
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    if not wav_path.exists():
        existing = list(AUDIO_CACHE.glob(f"{track_id}.*"))
        if existing:
            src = existing[0]
            if progress_cb:
                progress_cb("converting", "Converting audio to WAV...")
            subprocess.run(
                [str(FFMPEG_PATH), "-y", "-i", str(src), "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "2", str(wav_path)],
                capture_output=True,
            )
            src.unlink(missing_ok=True)

    return wav_path


def normalize_audio(wav_path: Path, progress_cb=None) -> Path:
    normalized = wav_path.parent / f"{wav_path.stem}_norm.wav"
    if normalized.exists():
        if progress_cb:
            progress_cb("cached", "Normalized audio already cached")
        return normalized

    if progress_cb:
        progress_cb("normalizing", "Normalizing loudness...")

    subprocess.run(
        [
            str(FFMPEG_PATH), "-y", "-i", str(wav_path),
            "-af", "loudnorm=I=-14:TP=-1:LRA=11",
            "-ar", "44100", "-ac", "2", str(normalized),
        ],
        capture_output=True,
    )
    return normalized


def get_audio_duration(wav_path: Path) -> float:
    result = subprocess.run(
        [str(FFMPEG_PATH), "-i", str(wav_path), "-f", "null", "-"],
        capture_output=True, text=True,
    )
    for line in result.stderr.split("\n"):
        if "Duration" in line:
            parts = line.strip().split(",")[0].split("Duration:")[-1].strip()
            h, m, s = parts.split(":")
            return int(h) * 3600 + int(m) * 60 + float(s)
    return 0.0
