"""Niveau 4 — masque causal et attention produit scalaire."""

from __future__ import annotations

import numpy as np

from model.mathutil import softmax


def causal_mask(query_positions: np.ndarray, key_positions: np.ndarray) -> np.ndarray:
    """Vrai quand la clé est à une position passée ou présente par rapport à la requête."""
    return key_positions[None, :] <= query_positions[:, None]


def scaled_dot_product_attention(
    query: np.ndarray,
    key: np.ndarray,
    value: np.ndarray,
    causal: bool = True,
) -> tuple[np.ndarray, np.ndarray]:
    """Attention pour un seul exemple.

    `query` et `key` ont la forme (Tq, D) et (Tk, D), `value` la forme (Tk, Dv).
    """
    query = np.asarray(query, dtype=np.float64)
    key = np.asarray(key, dtype=np.float64)
    value = np.asarray(value, dtype=np.float64)
    scale = 1.0 / np.sqrt(query.shape[-1])
    scores = (query @ key.T) * scale
    if causal:
        if query.shape[0] != key.shape[0]:
            raise ValueError("le masque causal simple suppose la même longueur pour Q et K")
        allowed = np.tril(np.ones((query.shape[0], key.shape[0]), dtype=bool))
        scores = np.where(allowed, scores, -1e9)
    weights = softmax(scores, axis=-1)
    return weights @ value, weights


def repeat_kv(states: np.ndarray, repeats: int) -> np.ndarray:
    """Duplique les têtes KV pour l'attention groupée. Forme (B, Kv, T, D)."""
    if repeats == 1:
        return states
    return np.repeat(states, repeats, axis=1)


def rope_cos_sin(positions: np.ndarray, head_dim: int, base: float = 10000.0) -> tuple[np.ndarray, np.ndarray]:
    if head_dim % 2 != 0:
        raise ValueError("RoPE demande un head_dim pair")
    half = head_dim // 2
    inv_freq = base ** (-np.arange(0, head_dim, 2, dtype=np.float64) / head_dim)
    angles = np.asarray(positions, dtype=np.float64)[:, None] * inv_freq[None, :]
    return np.cos(angles), np.sin(angles)


def apply_rope(states: np.ndarray, cos: np.ndarray, sin: np.ndarray) -> np.ndarray:
    """Rotation des paires de dimensions. `states` : (B, H, T, D)."""
    cos = cos[None, None, :, :]
    sin = sin[None, None, :, :]
    even = states[..., 0::2]
    odd = states[..., 1::2]
    rotated = np.empty_like(states)
    rotated[..., 0::2] = even * cos - odd * sin
    rotated[..., 1::2] = even * sin + odd * cos
    return rotated
