from __future__ import annotations

import csv
import os
from typing import Any


def _dataset_path() -> str:
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(base_dir, 'data', 'dataset.csv')


def load_data() -> list[dict[str, Any]]:
    """Load the dataset CSV as a list of row dictionaries."""
    data_path = _dataset_path()
    if not os.path.exists(data_path):
        raise FileNotFoundError(
            f"Dataset not found at '{data_path}'. "
            "Please place a Spotify CSV file at data/dataset.csv."
        )

    try:
        with open(data_path, 'r', encoding='utf-8-sig', newline='') as file_handle:
            reader = csv.DictReader(file_handle)
            return [dict(row) for row in reader]
    except Exception as exc:
        raise IOError(f"Failed to read dataset at '{data_path}': {exc}") from exc


def clean_data(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop empty rows and duplicate records."""
    seen: set[str] = set()
    cleaned: list[dict[str, Any]] = []
    for row in rows:
        if not row:
            continue
        track_id = row.get('track_id')
        if not track_id:
            track_id = f"{row.get('track_name', '')}-{row.get('artists', '')}"
        if track_id in seen:
            continue
        seen.add(track_id)
        cleaned.append(row)
    return cleaned


def get_clean_data() -> list[dict[str, Any]]:
    """Load and clean the dataset in one call."""
    return clean_data(load_data())
