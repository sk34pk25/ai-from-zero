"""Niveau 9 — découper une image en patches et les projeter."""

from __future__ import annotations

import numpy as np


def patchify(image: np.ndarray, patch: int) -> np.ndarray:
    """Découpe une image (H, W) ou (H, W, C) en patches non recouvrants, aplatis."""
    if patch < 1:
        raise ValueError("patch doit être positif")
    data = np.asarray(image, dtype=np.float64)
    if data.ndim == 2:
        data = data[:, :, None]
    if data.ndim != 3:
        raise ValueError("image attendue en (H, W) ou (H, W, C)")
    height, width, channels = data.shape
    if height % patch != 0 or width % patch != 0:
        raise ValueError("H et W doivent être divisibles par la taille de patch")
    grid_h = height // patch
    grid_w = width // patch
    blocks = data.reshape(grid_h, patch, grid_w, patch, channels)
    blocks = blocks.transpose(0, 2, 1, 3, 4)
    return blocks.reshape(grid_h * grid_w, patch * patch * channels)


def project_patches(patches: np.ndarray, weight: np.ndarray, bias: np.ndarray) -> np.ndarray:
    projected = np.asarray(patches, dtype=np.float64) @ weight + bias
    return projected
