"""Niveau 8 — récurrence sélective et scan affine associé."""

from __future__ import annotations

import numpy as np

from model.mathutil import softplus


def selective_scan(x: np.ndarray, a: np.ndarray, b: np.ndarray, c: np.ndarray, delta: np.ndarray) -> np.ndarray:
    """Récurrence diagonale : h_t = exp(delta_t * a) h_{t-1} + delta_t * b_t * x_t.

    Toutes les séries temporelles ont la forme (T, S). `a` a la forme (S,) et doit
    être négatif si l'on veut un état qui oublie.
    """
    signal = np.asarray(x, dtype=np.float64)
    decay = np.asarray(a, dtype=np.float64)
    input_gate = np.asarray(b, dtype=np.float64)
    output_gate = np.asarray(c, dtype=np.float64)
    step = np.asarray(delta, dtype=np.float64)
    if signal.shape != input_gate.shape or signal.shape != output_gate.shape or signal.shape != step.shape:
        raise ValueError("x, b, c et delta doivent partager la forme (T, S)")
    if decay.shape != (signal.shape[1],):
        raise ValueError("a doit avoir la forme (S,)")
    state = np.zeros(signal.shape[1], dtype=np.float64)
    outputs = np.zeros_like(signal)
    for time in range(signal.shape[0]):
        state = np.exp(step[time] * decay) * state + step[time] * input_gate[time] * signal[time]
        outputs[time] = output_gate[time] * state
    return outputs


def compose_affine(a1: float, b1: float, a2: float, b2: float) -> tuple[float, float]:
    """Composition : d'abord (a1, b1), puis (a2, b2)."""
    return a2 * a1, a2 * b1 + b2


def sequential_affine(a: np.ndarray, b: np.ndarray, h0: float = 0.0) -> np.ndarray:
    state = float(h0)
    outputs = np.empty(len(a), dtype=np.float64)
    for index, (scale, shift) in enumerate(zip(a, b, strict=True)):
        state = float(scale) * state + float(shift)
        outputs[index] = state
    return outputs


def parallel_affine(a: np.ndarray, b: np.ndarray, h0: float = 0.0) -> np.ndarray:
    """Scan associatif de Hillis-Steele pour h_t = a_t h_{t-1} + b_t."""
    scales = np.asarray(a, dtype=np.float64).copy()
    shifts = np.asarray(b, dtype=np.float64).copy()
    if scales.shape != shifts.shape or scales.ndim != 1:
        raise ValueError("a et b doivent être deux vecteurs de même longueur")
    count = len(scales)
    offset = 1
    while offset < count:
        next_scales = scales.copy()
        next_shifts = shifts.copy()
        for index in range(offset, count):
            composed_a, composed_b = compose_affine(scales[index - offset], shifts[index - offset], scales[index], shifts[index])
            next_scales[index] = composed_a
            next_shifts[index] = composed_b
        scales, shifts = next_scales, next_shifts
        offset *= 2
    return scales * float(h0) + shifts


def selective_params(hidden: np.ndarray, projection: dict[str, np.ndarray]) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Projette un signal (T, D) vers x, B, C et un delta positif."""
    signal = hidden @ projection["in"]
    input_gate = hidden @ projection["b"]
    output_gate = hidden @ projection["c"]
    delta = softplus(hidden @ projection["delta"]) + 1e-4
    return signal, input_gate, output_gate, delta
