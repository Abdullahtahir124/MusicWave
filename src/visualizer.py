"""
visualizer.py — matplotlib chart helpers for offline/notebook use.

The primary UI is the React dashboard (frontend/).
These utilities are kept for data exploration, Jupyter notebooks,
or any future CLI reporting needs.
"""

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.figure import Figure
from typing import Optional

FEATURES_TO_PLOT = [
    'danceability', 'energy', 'valence', 'acousticness', 'liveness',
]


def plot_similarity_bar(recommendations: pd.DataFrame) -> Figure:
    """Horizontal bar chart of similarity scores for the top-N recommendations."""
    fig, ax = plt.subplots(figsize=(8, 4))
    fig.patch.set_facecolor('#0f0f1a')
    ax.set_facecolor('#1a1a2e')

    colors = ['#a855f7', '#ec4899', '#3b82f6', '#8b5cf6', '#06b6d4']
    bars = ax.barh(
        recommendations['track_name'],
        recommendations['similarity'],
        color=colors[:len(recommendations)],
        edgecolor='none',
        height=0.6,
    )
    ax.bar_label(bars, fmt='%.2f', padding=4, color='white', fontsize=9)
    ax.set_xlabel('Cosine Similarity', color='#a0aec0')
    ax.set_title('Top Recommended Songs', color='white', fontsize=13, pad=12)
    ax.set_xlim(0, 1.05)
    ax.tick_params(colors='#a0aec0')
    ax.spines[:].set_color('#333')
    plt.tight_layout()
    return fig


def plot_feature_comparison(
    df: pd.DataFrame,
    song_name: str,
    recommendations: pd.DataFrame,
    top_n: int = 1,
) -> Optional[Figure]:
    """Grouped bar chart comparing audio features of the query song vs top-N recs."""
    matches = df[df['track_name'] == song_name]
    if matches.empty:
        return None

    song_data = matches.iloc[0]
    features = FEATURES_TO_PLOT
    x = np.arange(len(features))
    width = 0.7 / (top_n + 1)

    fig, ax = plt.subplots(figsize=(10, 5))
    fig.patch.set_facecolor('#0f0f1a')
    ax.set_facecolor('#1a1a2e')

    palette = ['#a855f7', '#ec4899', '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981']

    # Query song
    song_vals = [float(song_data.get(f, 0)) for f in features]
    ax.bar(x - width * top_n / 2, song_vals, width, label=song_name[:25],
           color=palette[0], alpha=0.9)

    # Recommendation(s)
    for i, (_, row) in enumerate(recommendations.head(top_n).iterrows()):
        rec_vals = [float(row[f]) if f in row.index else 0.0 for f in features]
        offset = width * (i + 1 - top_n / 2)
        ax.bar(x + offset, rec_vals, width,
               label=str(row['track_name'])[:25],
               color=palette[(i + 1) % len(palette)], alpha=0.9)

    ax.set_xticks(x)
    ax.set_xticklabels(features, rotation=30, ha='right', color='#a0aec0')
    ax.set_title('Audio Feature Comparison', color='white', fontsize=13, pad=12)
    ax.set_ylim(0, 1.1)
    ax.tick_params(colors='#a0aec0')
    ax.spines[:].set_color('#333')
    ax.legend(fontsize=8, facecolor='#1a1a2e', labelcolor='white',
              framealpha=0.8)
    plt.tight_layout()
    return fig


def plot_genre_distribution(df: pd.DataFrame, top_n: int = 15) -> Figure:
    """Bar chart of the top-N genre counts in the dataset."""
    if 'track_genre' not in df.columns:
        fig, ax = plt.subplots()
        ax.text(0.5, 0.5, 'No genre column found', ha='center', va='center',
                color='white')
        return fig

    counts = df['track_genre'].value_counts().head(top_n)

    fig, ax = plt.subplots(figsize=(10, 5))
    fig.patch.set_facecolor('#0f0f1a')
    ax.set_facecolor('#1a1a2e')

    ax.bar(counts.index, counts.values, color='#a855f7', edgecolor='none')
    ax.set_title(f'Top {top_n} Genres', color='white', fontsize=13, pad=12)
    ax.set_xlabel('Genre', color='#a0aec0')
    ax.set_ylabel('Count', color='#a0aec0')
    ax.tick_params(axis='x', rotation=45, colors='#a0aec0')
    ax.tick_params(axis='y', colors='#a0aec0')
    ax.spines[:].set_color('#333')
    plt.tight_layout()
    return fig
