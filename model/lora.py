"""LoRA écrit à la main : W devient W + échelle · A B.

A est (entrée, rang), B est (rang, sortie). B part à zéro, donc le
modèle adapté commence exactement au modèle préentraîné. Seuls A et B
reçoivent un gradient quand la base est gelée.
"""

from __future__ import annotations

import numpy as np

from model.autograd import Tensor


LORA_SUFFIXES = (".wq", ".wk", ".wv", ".wo", ".w1", ".w2", ".wg", ".wu", ".wd")


def lora_names(params: dict[str, np.ndarray]) -> list[str]:
    names = []
    for name, value in params.items():
        if getattr(value, "ndim", 0) == 2 and name.endswith(LORA_SUFFIXES):
            names.append(name)
    return names


def init_lora(params: dict[str, np.ndarray], rank: int, seed: int = 0, scale: float = 1.0) -> dict:
    if rank < 1:
        raise ValueError("le rang LoRA doit être au moins 1")
    rng = np.random.default_rng(seed)
    factors: dict[str, dict] = {}
    for name in lora_names(params):
        rows, cols = params[name].shape
        factors[name] = {
            "A": rng.normal(0.0, 0.02, size=(rows, rank)).astype(np.float64),
            "B": np.zeros((rank, cols), dtype=np.float64),
            "scale": float(scale),
        }
    if not factors:
        raise ValueError("aucune matrice compatible avec LoRA")
    return factors


def trainable_count(factors: dict) -> int:
    total = 0
    for factor in factors.values():
        total += int(np.size(factor["A"]) + np.size(factor["B"]))
    return total


def apply_lora_numpy(params: dict[str, np.ndarray], factors: dict) -> dict[str, np.ndarray]:
    merged = {name: np.array(value, dtype=np.float64, copy=True) for name, value in params.items()}
    for name, factor in factors.items():
        merged[name] = merged[name] + float(factor["scale"]) * (factor["A"] @ factor["B"])
    return merged


def lora_tensors(base: dict[str, Tensor], factors: dict, train_base: bool) -> tuple[dict[str, Tensor], dict[str, Tensor]]:
    """Retourne les poids effectifs (pour le forward) et les tenseurs à optimiser."""
    effective: dict[str, Tensor] = {}
    trainable: dict[str, Tensor] = {}
    held: dict[str, tuple[Tensor, Tensor]] = {}
    for name, tensor in base.items():
        if name not in factors:
            tensor.requires_grad = train_base
            if not train_base:
                tensor.grad = None
            effective[name] = tensor
            if train_base:
                trainable[name] = tensor
            continue
        factor = factors[name]
        left = Tensor(np.array(factor["A"], dtype=np.float64, copy=True))
        right = Tensor(np.array(factor["B"], dtype=np.float64, copy=True))
        held[name] = (left, right)
        tensor.requires_grad = train_base
        if not train_base:
            tensor.grad = None
        delta = left.matmul(right) * float(factor["scale"])
        effective[name] = tensor + delta
        trainable[f"{name}.A"] = left
        trainable[f"{name}.B"] = right
        if train_base:
            trainable[name] = tensor
    lora_tensors.held = held
    return effective, trainable


def read_factors(factors: dict) -> dict:
    """Relit A et B après un pas, pour les réinjecter au pas suivant."""
    held = getattr(lora_tensors, "held", {})
    updated = {}
    for name, factor in factors.items():
        left, right = held[name]
        updated[name] = {"A": np.array(left.data, copy=True), "B": np.array(right.data, copy=True), "scale": factor["scale"]}
    return updated
