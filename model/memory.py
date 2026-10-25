"""Niveau 10 — recherche par similarité, mémoire externe minimaliste."""

from __future__ import annotations

import re

import numpy as np

WORD = re.compile(r"[a-z0-9àâäéèêëïîôùûüçœ]+", re.IGNORECASE)


def tokenize_words(text: str) -> list[str]:
    return [match.group(0).lower() for match in WORD.finditer(text)]


def bow_vector(text: str, vocabulary: list[str]) -> np.ndarray:
    index = {token: position for position, token in enumerate(vocabulary)}
    counts = np.zeros(len(vocabulary), dtype=np.float64)
    for token in tokenize_words(text):
        if token in index:
            counts[index[token]] += 1.0
    norm = np.linalg.norm(counts)
    if norm == 0:
        return counts
    return counts / norm


def retrieve(query: str, documents: list[str], k: int = 2) -> list[dict]:
    if k < 1:
        raise ValueError("k doit être au moins 1")
    vocabulary = sorted({token for text in [query, *documents] for token in tokenize_words(text)})
    query_vector = bow_vector(query, vocabulary)
    scored = []
    for doc_index, document in enumerate(documents):
        score = float(query_vector @ bow_vector(document, vocabulary))
        scored.append({"score": score, "index": doc_index, "text": document})
    scored.sort(key=lambda row: (-row["score"], row["index"]))
    return scored[:k]


def build_context(query: str, documents: list[str], k: int = 2) -> str:
    hits = retrieve(query, documents, k=k)
    body = "\n".join(f"[{hit['index']}] {hit['text']}" for hit in hits)
    return f"Question : {query}\nExtraits :\n{body}"
