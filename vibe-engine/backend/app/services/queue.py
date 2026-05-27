import random
from typing import Optional
from ..models.schemas import VibeMode


class SessionState:
    def __init__(self):
        self.tracks = {}
        self.queue = []
        self.current_index = -1
        self.vibe_mode = VibeMode.CLUB
        self.is_playing = False
        self.current_position = 0.0
        self.skipped_tracks = set()
        self.liked_tracks = set()
        self.transition_history = []

    def set_vibe_mode(self, mode: VibeMode):
        self.vibe_mode = mode

    def get_vibe_params(self) -> dict:
        params = {
            VibeMode.CLUB: {"energy_curve": "build_peak", "genre_tolerance": 0.6, "transition_aggression": 0.7},
            VibeMode.CHILL: {"energy_curve": "sustained_low", "genre_tolerance": 0.8, "transition_aggression": 0.3},
            VibeMode.FOCUS: {"energy_curve": "flat", "genre_tolerance": 0.4, "transition_aggression": 0.2},
            VibeMode.LATE_NIGHT: {"energy_curve": "slow_descent", "genre_tolerance": 0.7, "transition_aggression": 0.5},
            VibeMode.AGGRESSIVE: {"energy_curve": "sustained_high", "genre_tolerance": 0.3, "transition_aggression": 0.9},
            VibeMode.EUPHORIC: {"energy_curve": "peak_plateau", "genre_tolerance": 0.5, "transition_aggression": 0.8},
            VibeMode.DEEP_HOUSE: {"energy_curve": "groove_steady", "genre_tolerance": 0.3, "transition_aggression": 0.6},
            VibeMode.EXPERIMENTAL: {"energy_curve": "random_walk", "genre_tolerance": 1.0, "transition_aggression": 0.5},
        }
        return params.get(self.vibe_mode, params[VibeMode.CLUB])


session = SessionState()


class QueuePlanner:
    def __init__(self, session: SessionState):
        self.session = session

    def add_track(self, track):
        self.session.tracks[track.id] = track
        self.session.queue.append(track.id)

    def remove_track(self, track_id: str):
        if track_id in self.session.queue:
            self.session.queue.remove(track_id)
        self.session.tracks.pop(track_id, None)

    def reorder(self, track_ids: list[str]):
        valid = [t for t in track_ids if t in self.session.tracks]
        self.session.queue = valid

    def get_next(self) -> Optional[str]:
        if not self.session.queue:
            return None
        if self.session.current_index < len(self.session.queue) - 1:
            self.session.current_index += 1
        else:
            self.session.current_index = 0
        return self.session.queue[self.session.current_index]

    def get_current(self) -> Optional[str]:
        if self.session.current_index >= 0 and self.session.current_index < len(self.session.queue):
            return self.session.queue[self.session.current_index]
        return None

    def advance(self) -> Optional[str]:
        self.session.current_index += 1
        if self.session.current_index >= len(self.session.queue):
            self.session.current_index = 0
        return self.get_current()

    def optimize_queue(self):
        if len(self.session.queue) < 2:
            return
        scored = []
        for i in range(len(self.session.queue) - 1):
            out_id = self.session.queue[i]
            in_id = self.session.queue[i + 1]
            out_track = self.session.tracks.get(out_id)
            in_track = self.session.tracks.get(in_id)
            if out_track and in_track and out_track.analysis and in_track.analysis:
                from ..audio.transition import score_transition
                score, _ = score_transition(
                    out_track.analysis.model_dump(),
                    in_track.analysis.model_dump(),
                )
                scored.append((i, score))
        low_scores = [s for s in scored if s[1] < 40]
        if low_scores:
            low_scores.sort(key=lambda x: x[1])
            self._swap_worst(low_scores[0][0])

    def _swap_worst(self, idx: int):
        if idx + 1 < len(self.session.queue):
            candidates = list(range(len(self.session.queue)))
            candidates.remove(idx)
            candidates.remove(idx + 1)
            best = None
            best_score = -1
            from ..audio.transition import score_transition
            for c in candidates:
                out_track = self.session.tracks.get(self.session.queue[idx])
                in_track = self.session.tracks.get(self.session.queue[c])
                if out_track and in_track and out_track.analysis and in_track.analysis:
                    s, _ = score_transition(
                        out_track.analysis.model_dump(),
                        in_track.analysis.model_dump(),
                    )
                    if s > best_score:
                        best_score = s
                        best = c
            if best is not None:
                self.session.queue[idx + 1], self.session.queue[best] = \
                    self.session.queue[best], self.session.queue[idx + 1]


planner = QueuePlanner(session)
