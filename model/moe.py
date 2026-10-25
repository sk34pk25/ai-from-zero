"""Niveau 7 — FFN mélange d'experts, top-k et perte d'équilibrage."""

from __future__ import annotations

import math

import numpy as np

from model.mathutil import softmax
from model.mlp import relu


def expert_forward(token: np.ndarray, expert: dict[str, np.ndarray]) -> np.ndarray:
    hidden = relu(token @ expert["w1"] + expert["b1"])
    return hidden @ expert["w2"] + expert["b2"]


def load_balance_loss(probs: np.ndarray, choices: np.ndarray) -> float:
    """Perte auxiliaire de type Switch : E * somme(f_i * P_i).

    Elle vaut environ 1 quand le routeur est uniforme, et E quand il s'effondre
    sur un seul expert avec une probabilité proche de 1.
    """
    probs = np.asarray(probs, dtype=np.float64)
    tokens, experts = probs.shape
    fractions = np.zeros(experts, dtype=np.float64)
    for choice in np.asarray(choices, dtype=np.int64):
        fractions[int(choice)] += 1.0
    fractions /= tokens
    mean_probs = probs.mean(axis=0)
    return float(experts * np.sum(fractions * mean_probs))


def moe_ffn(tokens: np.ndarray, experts: list[dict[str, np.ndarray]], router: np.ndarray, k: int = 1, capacity_factor: float = 1.25) -> dict:
    """Mélange les experts pour chaque token. Les tokens au-delà de la capacité sont ignorés."""
    data = np.asarray(tokens, dtype=np.float64)
    if data.ndim != 2:
        raise ValueError("tokens doit avoir la forme (T, D)")
    if k < 1:
        raise ValueError("k doit être au moins 1")
    n_tokens, _ = data.shape
    n_experts = len(experts)
    if router.shape != (data.shape[1], n_experts):
        raise ValueError("router doit avoir la forme (D, E)")
    logits = data @ router
    k = min(k, n_experts)
    chosen = np.argpartition(-logits, kth=k - 1, axis=-1)[:, :k]
    order = np.take_along_axis(logits, chosen, axis=-1)
    chosen = chosen[np.arange(n_tokens)[:, None], np.argsort(-order, axis=-1)]
    selected_logits = np.take_along_axis(logits, chosen, axis=-1)
    gates = softmax(selected_logits, axis=-1)
    capacity = max(1, math.ceil(capacity_factor * n_tokens / n_experts))
    used = np.zeros(n_experts, dtype=np.int64)
    output = np.zeros_like(data)
    dropped = 0
    for token_index in range(n_tokens):
        for slot, expert_index in enumerate(chosen[token_index]):
            expert_index = int(expert_index)
            if used[expert_index] >= capacity:
                dropped += 1
                continue
            used[expert_index] += 1
            output[token_index] += gates[token_index, slot] * expert_forward(data[token_index], experts[expert_index])
    return {
        "output": output,
        "aux": load_balance_loss(softmax(logits, axis=-1), chosen[:, 0]),
        "dropped": int(dropped),
        "capacity": int(capacity),
        "choices": chosen,
    }
