import subprocess
import json
import os
import re
from urllib.parse import urlparse, parse_qs
from pathlib import Path
import yt_dlp
from ..config import FFMPEG_PATH, TEMP_DIR, CACHE_DIR, ANALYSIS_CACHE_DIR

AUDIO_CACHE = CACHE_DIR / "audio"
AUDIO_CACHE.mkdir(exist_ok=True)


def parse_video_url(url: str):
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    video_id = qs.get("v", [None])[0]
    return video_id


def is_playlist_url(url: str) -> bool:
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    return "list" in qs


def extract_track_info(url: str):
    video_id = parse_video_url(url)

    if video_id:
        clean_url = f"https://www.youtube.com/watch?v={video_id}"
    else:
        clean_url = url

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "no_playlist": True if video_id else False,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(clean_url, download=False)

    if video_id:
        return video_id, info

    return info.get("id", ""), info


def extract_playlist_entries(url: str):
    ydl_opts = {"quiet": True, "no_warnings": True, "extract_flat": True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)

    entries = info.get("entries", [])
    results = []
    for entry in entries:
        vid = entry.get("id")
        if vid:
            entry_url = f"https://www.youtube.com/watch?v={vid}"
            results.append({
                "id": vid,
                "url": entry_url,
                "title": entry.get("title", "Unknown"),
                "uploader": entry.get("uploader", "Unknown") or entry.get("channel", "Unknown"),
            })
    return results


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
        "format": "bestaudio[ext=m4a]/bestaudio/best",
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
