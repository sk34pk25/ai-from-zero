"""Niveau 3 — modèle bigramme lissé, perplexité et échantillonnage."""

from __future__ import annotations

import numpy as np

from model.mathutil import softmax


class BigramModel:
    def __init__(self, vocab_size: int, alpha: float = 1.0):
        if vocab_size < 1:
            raise ValueError("vocab_size doit être positif")
        if alpha < 0:
            raise ValueError("alpha doit être positif ou nul")
        self.vocab_size = vocab_size
        self.alpha = alpha
        self.counts = np.full((vocab_size, vocab_size), alpha, dtype=np.float64)

    def observe(self, ids: list[int] | np.ndarray) -> None:
        sequence = [int(index) for index in ids]
        for left, right in zip(sequence, sequence[1:]):
            if not 0 <= left < self.vocab_size or not 0 <= right < self.vocab_size:
                raise IndexError("identifiant hors vocabulaire")
            self.counts[left, right] += 1.0

    def probabilities(self) -> np.ndarray:
        totals = self.counts.sum(axis=1, keepdims=True)
        return self.counts / totals

    def nll(self, ids: list[int] | np.ndarray) -> float:
        sequence = [int(index) for index in ids]
        if len(sequence) < 2:
            raise ValueError("il faut au moins deux tokens pour évaluer un bigramme")
        probs = self.probabilities()
        total = 0.0
        for left, right in zip(sequence, sequence[1:]):
            total -= float(np.log(probs[left, right]))
        return total / (len(sequence) - 1)

    def perplexity(self, ids: list[int] | np.ndarray) -> float:
        return float(np.exp(self.nll(ids)))

    def generate(self, start: int, length: int, rng: np.random.Generator, temperature: float = 1.0, top_k: int | None = None) -> list[int]:
        if length < 0:
            raise ValueError("length doit être positif ou nul")
        probs = self.probabilities()
        tokens = [int(start)]
        for _ in range(length):
            row = probs[tokens[-1]]
            logits = np.log(np.clip(row, 1e-12, 1.0))
            tokens.append(int(sample_logits(logits[None, :], rng, temperature, top_k)[0]))
        return tokens


def sample_logits(logits: np.ndarray, rng: np.random.Generator, temperature: float = 1.0, top_k: int | None = None) -> np.ndarray:
    scores = np.array(logits, dtype=np.float64, copy=True)
    if temperature < 0:
        raise ValueError("temperature doit être positive ou nulle")
    if temperature == 0:
        return np.argmax(scores, axis=-1).astype(np.int64)
    scores /= temperature
    if top_k is not None:
        if top_k < 1:
            raise ValueError("top_k doit être au moins 1")
        k = min(top_k, scores.shape[-1])
        cutoff = np.partition(scores, -k, axis=-1)[..., -k]
        scores = np.where(scores >= cutoff[..., None], scores, -1e9)
    probs = softmax(scores, axis=-1)
    chosen = np.empty(probs.shape[0], dtype=np.int64)
    for index, row in enumerate(probs):
        chosen[index] = rng.choice(len(row), p=row)
    return chosen
