"""Sépare des documents entiers après normalisation NFC et retrait des doublons exacts."""

import argparse
import hashlib
import json
from pathlib import Path
import random
import unicodedata


def normaliser(s):
    return (
        unicodedata.normalize(
            "NFC", s.replace("\r\n", "\n").replace("\r", "\n")
        ).strip()
        + "\n"
    )


def preparer(source, destination, seed=0):
    source, destination = Path(source), Path(destination)
    if destination.exists() and any(destination.iterdir()):
        raise ValueError("Le dossier de sortie doit être vide")
    rows = []
    seen = set()
    duplicates = []
    for file in sorted(source.glob("*.txt")):
        text = normaliser(file.read_text(encoding="utf-8"))
        if not text.strip():
            continue
        digest = hashlib.sha256(text.encode()).hexdigest()
        if digest in seen:
            duplicates.append(file.name)
            continue
        seen.add(digest)
        rows.append({"document": file.name, "sha256": digest, "texte": text})
    if len(rows) < 3:
        raise ValueError("Au moins trois documents distincts sont requis")
    random.Random(seed).shuffle(rows)
    ntest = max(1, round(len(rows) * 0.1))
    nval = max(1, round(len(rows) * 0.2))
    groups = {
        "train": rows[ntest + nval :],
        "validation": rows[ntest : ntest + nval],
        "test": rows[:ntest],
    }
    destination.mkdir(parents=True, exist_ok=True)
    for name, docs in groups.items():
        (destination / (name + ".txt")).write_text(
            "\n".join(d["texte"] for d in docs), encoding="utf-8"
        )
    meta = {
        "seed": seed,
        "splits": {
            k: hashlib.sha256((destination / (k + ".txt")).read_bytes()).hexdigest()
            for k in groups
        },
        "normalisation": "NFC, retours ligne LF, bords retirés",
        "doublons_retires": duplicates,
        "documents": {
            k: [{a: b for a, b in d.items() if a != "texte"} for d in v]
            for k, v in groups.items()
        },
        "limite": "Détection exacte seulement : relire les quasi-doublons et la provenance/licence.",
    }
    (destination / "provenance.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return meta


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("source", type=Path)
    p.add_argument("destination", type=Path)
    p.add_argument("--seed", type=int, default=0)
    a = p.parse_args()
    print(
        json.dumps(
            preparer(a.source, a.destination, a.seed), ensure_ascii=False, indent=2
        )
    )
