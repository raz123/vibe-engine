import json
import numpy as np
import librosa
from pathlib import Path
from ..config import ANALYSIS_CACHE_DIR


KEY_PROFILE_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KEY_PROFILE_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
CAMELOT = {
    "C": "8B", "C#": "3B", "D": "10B", "D#": "5B", "E": "12B", "F": "7B",
    "F#": "2B", "G": "9B", "G#": "4B", "A": "11B", "A#": "6B", "B": "1B",
    "Cm": "5A", "C#m": "12A", "Dm": "7A", "D#m": "2A", "Em": "9A", "Fm": "4A",
    "F#m": "11A", "Gm": "6A", "G#m": "1A", "Am": "8A", "A#m": "3A", "Bm": "10A",
}

MOOD_CLASSIFIER = {
    "bpm_ranges": {"chill": (60, 100), "hype": (120, 150), "ambient": (50, 80), "euphoric": (125, 140), "dark": (70, 110)},
    "energy_thresholds": {"ambient": 0.3, "chill": 0.5, "euphoric": 0.7, "hype": 0.8, "aggressive": 0.85},
}


def detect_key(y, sr):
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = np.mean(chroma, axis=1)

    corr_major = np.correlate(chroma_mean, KEY_PROFILE_MAJOR, mode="same")
    corr_minor = np.correlate(chroma_mean, KEY_PROFILE_MINOR, mode="same")

    key_idx = np.argmax(np.concatenate([corr_major, corr_minor]))
    is_minor = key_idx >= 12

    note_idx = key_idx % 12
    key_name = NOTES[note_idx] + ("m" if is_minor else "")
    camelot = CAMELOT.get(key_name, "Unknown")

    return key_name, camelot, float(np.max(np.concatenate([corr_major, corr_minor])))


def detect_bpm(y, sr):
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    if hasattr(tempo, "__iter__"):
        tempo = tempo[0]
    bpm = float(tempo)
    confidence = min(1.0, len(beat_frames) / (y.shape[0] / sr) * 2) if len(beat_frames) > 0 else 0.0
    return bpm, confidence


def detect_structure(y, sr):
    hop_length = 512
    oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
    tempo, beat_frames = librosa.beat.beat_track(onset_envelope=oenv, sr=sr, hop_length=hop_length, units="frames")
    if hasattr(tempo, "__iter__"):
        tempo = float(tempo[0])
    beat_times = librosa.frames_to_time(beat_frames, sr=sr, hop_length=hop_length)

    if len(beat_times) < 4:
        return {"intro": 0, "outro": 0, "segments": []}

    intro_end = beat_times[min(8, len(beat_times) // 4)] if len(beat_times) > 8 else 0
    outro_start = beat_times[max(len(beat_times) - 8, len(beat_times) // 2)] if len(beat_times) > 8 else float(len(y) / sr)

    return {
        "intro_end": float(intro_end),
        "outro_start": float(outro_start),
        "beat_times": [float(t) for t in beat_times],
        "total_beats": len(beat_times),
    }


def compute_energy(y, sr):
    rms = librosa.feature.rms(y=y)[0]
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    zero_crossing = librosa.feature.zero_crossing_rate(y)[0]

    energy = float(np.mean(rms))
    brightness = float(np.mean(spectral_centroid) / (sr / 2))
    rhythmic_density = float(np.mean(zero_crossing))

    return {
        "energy": min(1.0, energy * 10),
        "brightness": min(1.0, brightness),
        "rhythmic_density": min(1.0, rhythmic_density * 5),
    }


def classify_mood(bpm, energy, brightness):
    moods = []
    if bpm < 90 and energy < 0.4:
        moods.append("chill")
    if bpm < 80 and energy < 0.3:
        moods.append("ambient")
    if bpm > 120 and energy > 0.6:
        moods.append("hype")
    if energy > 0.75:
        moods.append("aggressive")
    if brightness > 0.5 and energy > 0.5:
        moods.append("euphoric")
    if energy < 0.4 and brightness < 0.3:
        moods.append("dark")
    if 90 <= bpm <= 125 and energy >= 0.4 and energy <= 0.7:
        moods.append("melodic")
    if not moods:
        moods.append("melodic")
    return moods


def analyze_track(wav_path: Path, progress_cb=None) -> dict:
    cache_key = wav_path.stem.replace("_norm", "")
    cache_file = ANALYSIS_CACHE_DIR / f"{cache_key}.json"

    if cache_file.exists():
        return json.loads(cache_file.read_text())

    if progress_cb:
        progress_cb("analyzing", "Loading audio for analysis...")

    y, sr = librosa.load(str(wav_path), sr=22050, mono=True, duration=300)

    if progress_cb:
        progress_cb("analyzing_bpm", "Detecting BPM...")
    bpm, bpm_confidence = detect_bpm(y, sr)

    if progress_cb:
        progress_cb("analyzing_key", "Detecting musical key...")
    key, camelot, key_confidence = detect_key(y, sr)

    if progress_cb:
        progress_cb("analyzing_structure", "Analyzing song structure...")
    structure = detect_structure(y, sr)

    if progress_cb:
        progress_cb("analyzing_energy", "Computing energy and mood...")
    energy_data = compute_energy(y, sr)
    moods = classify_mood(bpm, energy_data["energy"], energy_data["brightness"])

    result = {
        "bpm": bpm,
        "bpm_confidence": bpm_confidence,
        "key": key,
        "key_camelot": camelot,
        "key_confidence": key_confidence,
        "energy": energy_data["energy"],
        "brightness": energy_data["brightness"],
        "rhythmic_density": energy_data["rhythmic_density"],
        "danceability": min(1.0, (energy_data["energy"] * 0.4 + (1 - abs(bpm - 120) / 120) * 0.3 + (1 - energy_data["rhythmic_density"]) * 0.3)),
        "mood": moods,
        "structure": structure,
        "loudness": -14.0,
    }

    cache_file.write_text(json.dumps(result, indent=2))
    return result
