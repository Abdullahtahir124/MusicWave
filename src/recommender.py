from __future__ import annotations

import math
from typing import Any

FEATURE_COLUMNS = [
    'danceability',
    'energy',
    'valence',
    'tempo',
    'acousticness',
    'instrumentalness',
    'speechiness',
    'liveness',
]


def _to_float(value: Any) -> float:
    try:
        return float(value)
    except Exception:
        return 0.0


def recommend_songs(rows: list[dict[str, Any]], track_id: str, limit: int = 5) -> list[dict[str, Any]]:
    if not rows:
        return []

    seed = next((row for row in rows if str(row.get('track_name', '')) == str(track_id)), None)
    if seed is None:
        return []

    feature_cols = [column for column in FEATURE_COLUMNS if any(column in row for row in rows)]
    if not feature_cols:
        return []

    def vector(row: dict[str, Any]) -> list[float]:
        return [_to_float(row.get(column, 0)) for column in feature_cols]

    seed_vector = vector(seed)
    seed_norm = math.sqrt(sum(value * value for value in seed_vector)) or 1.0

    scored: list[tuple[float, dict[str, Any]]] = []
    for row in rows:
        if str(row.get('track_name', '')) == str(track_id):
            continue
        candidate_vector = vector(row)
        candidate_norm = math.sqrt(sum(value * value for value in candidate_vector)) or 1.0
        dot = sum(a * b for a, b in zip(seed_vector, candidate_vector))
        score = dot / (seed_norm * candidate_norm)
        scored.append((score, row))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [row | {'similarity': round(score, 4)} for score, row in scored[: max(1, limit)]]
