"""Niveau 6 — octets, FLOPs et tableau de configurations."""

from __future__ import annotations

BYTES = {"fp32": 4.0, "fp16": 2.0, "bf16": 2.0, "int8": 1.0, "int4": 0.5}


def parameter_bytes(n_params: int, dtype: str = "fp32", optimizer: str = "none") -> float:
    if dtype not in BYTES:
        raise ValueError(f"dtype inconnu : {dtype}")
    if n_params < 0:
        raise ValueError("n_params doit être positif ou nul")
    weight = n_params * BYTES[dtype]
    if optimizer == "none" or optimizer == "sgd":
        extra = 0.0
    elif optimizer == "adam":
        extra = n_params * 8.0
    else:
        raise ValueError(f"optimiseur inconnu : {optimizer}")
    return weight + extra


def attention_flops(tokens: int, d_model: int, n_layers: int) -> int:
    """FLOPs dominants de l'attention, une multiplication-addition compte pour 2.

    Projections Q, K, V et sortie : 8 * T * d * d par couche.
    Produits QKᵀ et AV : 4 * T * T * d par couche.
    """
    project = n_layers * 8 * tokens * d_model * d_model
    attend = n_layers * 4 * tokens * tokens * d_model
    return project + attend


def ffn_flops(tokens: int, d_model: int, d_ff: int, n_layers: int, gated: bool = False) -> int:
    matrices = 3 if gated else 2
    return n_layers * matrices * 2 * tokens * d_model * d_ff


def quality_table(rows: list[dict]) -> list[dict]:
    """Trie des mesures déjà calculées. Chaque ligne a name, quality, seconds, ram_bytes."""
    required = {"name", "quality", "seconds", "ram_bytes"}
    normalized = []
    for row in rows:
        missing = required - set(row)
        if missing:
            raise ValueError(f"colonnes manquantes : {sorted(missing)}")
        normalized.append({key: row[key] for key in ("name", "quality", "seconds", "ram_bytes")})
    return sorted(normalized, key=lambda row: (-float(row["quality"]), float(row["seconds"]), float(row["ram_bytes"])))
