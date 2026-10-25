"""Niveau 1 — neurone, ReLU et régression entraînée à la main."""

from __future__ import annotations

import numpy as np


def relu(values: np.ndarray) -> np.ndarray:
    return np.maximum(0.0, values)


def neuron(inputs: np.ndarray, weights: np.ndarray, bias: float) -> float:
    inputs = np.asarray(inputs, dtype=np.float64)
    weights = np.asarray(weights, dtype=np.float64)
    if inputs.shape != weights.shape:
        raise ValueError("entrées et poids doivent avoir la même forme")
    return float(inputs @ weights + bias)


def mlp_forward(features: np.ndarray, w1: np.ndarray, b1: np.ndarray, w2: np.ndarray, b2: np.ndarray) -> np.ndarray:
    hidden = relu(np.asarray(features, dtype=np.float64) @ w1 + b1)
    return hidden @ w2 + b2


def train_linear_regression(x, y, steps: int = 80, lr: float = 0.1, seed: int = 0) -> dict:
    """Ajuste y ≈ w x + b par descente de gradient sur l'erreur quadratique moyenne."""
    rng = np.random.default_rng(seed)
    inputs = np.asarray(x, dtype=np.float64).reshape(-1)
    targets = np.asarray(y, dtype=np.float64).reshape(-1)
    if inputs.shape != targets.shape or inputs.size == 0:
        raise ValueError("x et y doivent être deux séries de même longueur")
    weight = float(rng.normal())
    bias = float(rng.normal())
    losses: list[float] = []
    for _ in range(steps):
        error = weight * inputs + bias - targets
        losses.append(float(np.mean(error**2)))
        weight -= lr * float(np.mean(2.0 * error * inputs))
        bias -= lr * float(np.mean(2.0 * error))
    return {"w": weight, "b": bias, "losses": losses}
