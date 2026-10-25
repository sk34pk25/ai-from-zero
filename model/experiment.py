"""Niveaux 11 et 12 — comparer une variante à une baseline."""

from __future__ import annotations

from model.bigram import BigramModel


def run_ablation(configs: list[dict], train_fn) -> list[dict]:
    rows = []
    for config in configs:
        if "name" not in config:
            raise ValueError("chaque configuration a un name")
        metrics = train_fn(dict(config))
        rows.append({"name": config["name"], **metrics})
    return rows


def split_sequence(ids: list[int], train_ratio: float = 0.8) -> tuple[list[int], list[int]]:
    if not 0 < train_ratio < 1:
        raise ValueError("train_ratio est compris entre 0 et 1, exclus")
    cut = max(2, min(len(ids) - 2, int(len(ids) * train_ratio)))
    if cut >= len(ids) - 1:
        raise ValueError("séquence trop courte pour un découpage train/test")
    return list(ids[:cut]), list(ids[cut:])


def bigram_versus_uniform(ids: list[int], vocab_size: int) -> dict[str, float | int]:
    train, test = split_sequence(ids)
    model = BigramModel(vocab_size)
    model.observe(train)
    return {
        "bigram_perplexity": model.perplexity(test),
        "uniform_perplexity": float(vocab_size),
        "train_tokens": len(train),
        "test_tokens": len(test),
    }
