CAMELOT_ADJACENT = {
    "1B": ["12B", "2B", "1A"],
    "2B": ["1B", "3B", "2A"],
    "3B": ["2B", "4B", "3A"],
    "4B": ["3B", "5B", "4A"],
    "5B": ["4B", "6B", "5A"],
    "6B": ["5B", "7B", "6A"],
    "7B": ["6B", "8B", "7A"],
    "8B": ["7B", "9B", "8A"],
    "9B": ["8B", "10B", "9A"],
    "10B": ["9B", "11B", "10A"],
    "11B": ["10B", "12B", "11A"],
    "12B": ["11B", "1B", "12A"],
    "1A": ["12A", "2A", "1B"],
    "2A": ["1A", "3A", "2B"],
    "3A": ["2A", "4A", "3B"],
    "4A": ["3A", "5A", "4B"],
    "5A": ["4A", "6A", "5B"],
    "6A": ["5A", "7A", "6B"],
    "7A": ["6A", "8A", "7B"],
    "8A": ["7A", "9A", "8B"],
    "9A": ["8A", "10A", "9B"],
    "10A": ["9A", "11A", "10B"],
    "11A": ["10A", "12A", "11B"],
    "12A": ["11A", "1A", "12B"],
}

TRANSITION_TYPES = ["crossfade", "eq_blend", "drum_carry", "vocal_swap", "drop_transition", "echo_exit"]


def score_transition(outgoing: dict, incoming: dict) -> tuple:
    score = 0.0
    reasons = []

    bpm_delta = abs(outgoing["bpm"] - incoming["bpm"])
    if bpm_delta < 3:
        score += 30
        reasons.append("bpm_match")
    elif bpm_delta < 8:
        score += 20
        reasons.append("bpm_near")
    else:
        score += max(0, 10 - bpm_delta)

    out_key = outgoing.get("key_camelot", "")
    in_key = incoming.get("key_camelot", "")
    if out_key and in_key:
        if out_key == in_key:
            score += 25
            reasons.append("perfect_key")
        elif in_key in CAMELOT_ADJACENT.get(out_key, []):
            score += 18
            reasons.append("key_adjacent")
        else:
            score += 5

    energy_delta = abs(outgoing.get("energy", 0.5) - incoming.get("energy", 0.5))
    if energy_delta < 0.15:
        score += 20
        reasons.append("energy_match")
    elif energy_delta < 0.3:
        score += 10
        reasons.append("energy_near")

    out_moods = set(outgoing.get("mood", []))
    in_moods = set(incoming.get("mood", []))
    overlap = len(out_moods & in_moods)
    if overlap > 0:
        score += 15 * (overlap / max(len(out_moods | in_moods), 1))
        reasons.append("mood_overlap")

    score = min(100, score)
    return score, reasons


def pick_transition_type(score: float, outgoing: dict, incoming: dict, stems_available: bool) -> str:
    if score > 85 and stems_available:
        return "vocal_swap"
    if score > 75:
        return "drop_transition" if outgoing.get("energy", 0) > 0.7 else "drum_carry"
    if score > 60:
        return "eq_blend"
    if score > 40:
        return "crossfade"
    return "echo_exit"


def plan_transition(outgoing: dict, incoming: dict, stems_available: bool = False) -> dict:
    score, reasons = score_transition(outgoing, incoming)
    t_type = pick_transition_type(score, outgoing, incoming, stems_available)

    crossfade_duration = 4.0
    if t_type == "drum_carry":
        crossfade_duration = 8.0
    elif t_type == "vocal_swap":
        crossfade_duration = 6.0
    elif t_type == "echo_exit":
        crossfade_duration = 3.0

    out_structure = outgoing.get("structure", {})
    in_structure = incoming.get("structure", {})

    timestamp_out = out_structure.get("outro_start", 0)
    timestamp_in = in_structure.get("intro_end", 0)

    return {
        "transition_type": t_type,
        "crossfade_duration": crossfade_duration,
        "score": score,
        "reasons": reasons,
        "timestamp_out": timestamp_out,
        "timestamp_in": timestamp_in,
        "eq_settings": {
            "outgoing_highcut": 0.3 if t_type in ("eq_blend", "drum_carry") else 1.0,
            "incoming_lowcut": 0.3 if t_type in ("eq_blend", "vocal_swap") else 0.0,
        },
    }
