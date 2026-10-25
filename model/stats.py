"""Niveau 0 — lire des nombres, résumer, sauvegarder."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np


def load_numbers(path: str | Path) -> list[float]:
    values: list[float] = []
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        values.append(float(line.replace(",", ".")))
    if not values:
        raise ValueError(f"aucune valeur numérique dans {path}")
    return values


def summarize(values: list[float] | np.ndarray) -> dict[str, float | int]:
    array = np.asarray(values, dtype=np.float64)
    if array.size == 0:
        raise ValueError("la série est vide")
    return {
        "n": int(array.size),
        "mean": float(array.mean()),
        "std": float(array.std(ddof=0)),
        "min": float(array.min()),
        "max": float(array.max()),
    }


def save_report(path: str | Path, report: dict) -> None:
    Path(path).write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def build_report(source: str | Path, destination: str | Path) -> dict:
    report = summarize(load_numbers(source))
    save_report(destination, report)
    return report
