"""Opérations numériques partagées par le laboratoire."""

from __future__ import annotations

import numpy as np


def softmax(logits: np.ndarray, axis: int = -1) -> np.ndarray:
    """Softmax stable : on soustrait le maximum avant l'exponentielle."""
    shifted = logits - np.max(logits, axis=axis, keepdims=True)
    exp = np.exp(shifted)
    return exp / np.sum(exp, axis=axis, keepdims=True)


def cross_entropy(logits: np.ndarray, targets: np.ndarray) -> float:
    """Entropie croisée moyenne. `logits` est (N, V), `targets` des indices (N,)."""
    logits = np.asarray(logits, dtype=np.float64)
    targets = np.asarray(targets, dtype=np.int64)
    if logits.ndim != 2:
        raise ValueError("logits doit avoir la forme (N, V)")
    if targets.shape != (logits.shape[0],):
        raise ValueError("targets doit avoir la forme (N,)")
    shifted = logits - np.max(logits, axis=1, keepdims=True)
    log_z = np.log(np.sum(np.exp(shifted), axis=1))
    picked = shifted[np.arange(logits.shape[0]), targets]
    return float(np.mean(-(picked - log_z)))


def cross_entropy_grad(logits: np.ndarray, targets: np.ndarray) -> np.ndarray:
    """Gradient de la cross-entropy moyenne : (softmax - one_hot) / N."""
    probs = softmax(np.asarray(logits, dtype=np.float64), axis=-1)
    grad = probs
    grad[np.arange(len(targets)), np.asarray(targets, dtype=np.int64)] -= 1.0
    grad /= len(targets)
    return grad


def silu(values: np.ndarray) -> np.ndarray:
    """SiLU / swish : x * sigmoid(x)."""
    values = np.asarray(values, dtype=np.float64)
    return values / (1.0 + np.exp(-values))


def gelu(values: np.ndarray) -> np.ndarray:
    """Approximation tanh de GELU, utilisée par beaucoup d'implémentations GPT."""
    values = np.asarray(values, dtype=np.float64)
    inner = np.sqrt(2.0 / np.pi) * (values + 0.044715 * values**3)
    return 0.5 * values * (1.0 + np.tanh(inner))


def softplus(values: np.ndarray) -> np.ndarray:
    values = np.asarray(values, dtype=np.float64)
    return np.log1p(np.exp(-np.abs(values))) + np.maximum(values, 0.0)


def layernorm(values: np.ndarray, gain: np.ndarray, bias: np.ndarray, eps: float = 1e-5) -> np.ndarray:
    mean = np.mean(values, axis=-1, keepdims=True)
    var = np.mean((values - mean) ** 2, axis=-1, keepdims=True)
    return gain * (values - mean) / np.sqrt(var + eps) + bias


def rmsnorm(values: np.ndarray, gain: np.ndarray, eps: float = 1e-5) -> np.ndarray:
    ms = np.mean(values**2, axis=-1, keepdims=True)
    return gain * values / np.sqrt(ms + eps)


def numerical_derivative(fn, point: float, eps: float = 1e-6) -> float:
    """Pente locale par différence centrée."""
    return float((fn(point + eps) - fn(point - eps)) / (2 * eps))


def numerical_grad_scalar(fn, value: float, eps: float = 1e-5) -> float:
    return numerical_derivative(fn, value, eps)
