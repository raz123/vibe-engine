import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
CACHE_DIR = BASE_DIR / "cache"
STEM_CACHE_DIR = CACHE_DIR / "stems"
ANALYSIS_CACHE_DIR = CACHE_DIR / "analysis"
TEMP_DIR = BASE_DIR / "temp"

for d in [CACHE_DIR, STEM_CACHE_DIR, ANALYSIS_CACHE_DIR, TEMP_DIR]:
    d.mkdir(parents=True, exist_ok=True)

FFMPEG_PATH = "C:\\Users\\tower\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffmpeg.exe"
FFPROBE_PATH = "C:\\Users\\tower\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.1-full_build\\bin\\ffprobe.exe"

YT_DLP_PATH = None  # use system-installed yt-dlp

MAX_CACHE_GB = 10
MAX_QUEUE_SIZE = 50
DEFAULT_CROSSFADE_SECONDS = 4.0
