"""Byte-Pair Encoding déterministe, sans dépendance hors NumPy.

Les fusions sont apprises sur le texte. À fréquence égale, la paire
lexicographiquement plus petite gagne : deux entraînements sur le même
texte et le même nombre de fusions produisent le même vocabulaire.
"""

from __future__ import annotations

import json
from pathlib import Path


class BPETokenizer:
    def __init__(self, vocab: dict[str, int], merges: list[tuple[str, str]]):
        if not vocab:
            raise ValueError("le vocabulaire est vide")
        self.vocab = {str(token): int(index) for token, index in vocab.items()}
        self.itos = {index: token for token, index in self.vocab.items()}
        if len(self.itos) != len(self.vocab):
            raise ValueError("identifiants de vocabulaire en double")
        self.merges = [(str(left), str(right)) for left, right in merges]
        for left, right in self.merges:
            piece = left + right
            if piece not in self.vocab:
                raise ValueError(f"fusion absente du vocabulaire : {piece!r}")

    @property
    def vocab_size(self) -> int:
        return len(self.vocab)

    def token_string(self, index: int) -> str:
        try:
            return self.itos[int(index)]
        except KeyError as error:
            raise KeyError(f"identifiant hors vocabulaire : {index}") from error

    @classmethod
    def train(cls, text: str, num_merges: int) -> "BPETokenizer":
        if not text:
            raise ValueError("le corpus d'entraînement est vide")
        if num_merges < 0:
            raise ValueError("num_merges doit être positif ou nul")
        symbols = sorted(set(text))
        vocab = {symbol: index for index, symbol in enumerate(symbols)}
        tokens = list(text)
        merges: list[tuple[str, str]] = []
        for _ in range(num_merges):
            counts: dict[tuple[str, str], int] = {}
            for left, right in zip(tokens, tokens[1:]):
                pair = (left, right)
                counts[pair] = counts.get(pair, 0) + 1
            if not counts:
                break
            pair = min(counts, key=lambda item: (-counts[item], item[0], item[1]))
            tokens = _merge(tokens, pair)
            merges.append(pair)
            vocab[pair[0] + pair[1]] = len(vocab)
        return cls(vocab, merges)

    def encode(self, text: str) -> list[int]:
        unknown = sorted({char for char in text if char not in self.vocab})
        if unknown:
            raise KeyError(f"caractères absents du vocabulaire : {''.join(unknown)}")
        tokens = list(text)
        for pair in self.merges:
            tokens = _merge(tokens, pair)
        return [self.vocab[token] for token in tokens]

    def decode(self, ids: list[int]) -> str:
        return "".join(self.token_string(index) for index in ids)

    def to_dict(self) -> dict:
        return {"vocab": self.vocab, "merges": [list(pair) for pair in self.merges]}

    @classmethod
    def from_dict(cls, payload: dict) -> "BPETokenizer":
        merges = [tuple(pair) for pair in payload.get("merges", [])]
        return cls(payload["vocab"], merges)

    def save(self, path: str | Path) -> None:
        destination = Path(path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(json.dumps(self.to_dict(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    @classmethod
    def load(cls, path: str | Path) -> "BPETokenizer":
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls.from_dict(payload)


def _merge(tokens: list[str], pair: tuple[str, str]) -> list[str]:
    left, right = pair
    piece = left + right
    merged: list[str] = []
    index = 0
    last = len(tokens) - 1
    while index < len(tokens):
        if index < last and tokens[index] == left and tokens[index + 1] == right:
            merged.append(piece)
            index += 2
        else:
            merged.append(tokens[index])
            index += 1
    return merged


def pair_counts(tokens: list[str]) -> dict[tuple[str, str], int]:
    counts: dict[tuple[str, str], int] = {}
    for left, right in zip(tokens, tokens[1:]):
        pair = (left, right)
        counts[pair] = counts.get(pair, 0) + 1
    return counts
