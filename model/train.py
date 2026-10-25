"""Boucles d'entraînement volontairement petites et explicites."""

from __future__ import annotations

import numpy as np

from model.mathutil import cross_entropy, cross_entropy_grad


def train_linear_classifier(features, targets, n_classes: int, steps: int = 80, lr: float = 0.8, seed: int = 0) -> dict:
    """Entraîne une tête linéaire avec le gradient exact de la cross-entropy.

    Le problème est convexe en W : avec un pas raisonnable, la loss baisse.
    """
    inputs = np.asarray(features, dtype=np.float64)
    labels = np.asarray(targets, dtype=np.int64)
    if inputs.ndim != 2 or labels.shape != (inputs.shape[0],):
        raise ValueError("features (N, D) et targets (N,) attendus")
    rng = np.random.default_rng(seed)
    weights = rng.normal(0.0, 0.02, size=(inputs.shape[1], n_classes))
    losses: list[float] = []
    for _ in range(steps):
        logits = inputs @ weights
        losses.append(cross_entropy(logits, labels))
        grad_logits = cross_entropy_grad(logits, labels)
        weights -= lr * (inputs.T @ grad_logits)
    return {"weights": weights, "losses": losses}
