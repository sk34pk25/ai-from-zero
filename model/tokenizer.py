"""Niveau 2 — tokenizer caractère et mini-BPE déterministe."""

from __future__ import annotations


class CharTokenizer:
    def __init__(self, text: str):
        if not text:
            raise ValueError("le corpus d'initialisation est vide")
        chars = sorted(set(text))
        self.stoi = {char: index for index, char in enumerate(chars)}
        self.itos = {index: char for char, index in self.stoi.items()}

    @property
    def vocab_size(self) -> int:
        return len(self.stoi)

    def encode(self, text: str) -> list[int]:
        unknown = sorted({char for char in text if char not in self.stoi})
        if unknown:
            raise KeyError(f"caractères absents du vocabulaire : {''.join(unknown)}")
        return [self.stoi[char] for char in text]

    def decode(self, ids: list[int]) -> str:
        try:
            return "".join(self.itos[int(index)] for index in ids)
        except KeyError as error:
            raise KeyError(f"identifiant hors vocabulaire : {error}") from error


def visualize(tokenizer: CharTokenizer, text: str) -> str:
    ids = tokenizer.encode(text)
    return " ".join(f"{char}|{index}" for char, index in zip(text, ids))


def pair_counts(tokens: list[int]) -> dict[tuple[int, int], int]:
    counts: dict[tuple[int, int], int] = {}
    for left, right in zip(tokens, tokens[1:]):
        pair = (left, right)
        counts[pair] = counts.get(pair, 0) + 1
    return counts


def merge_pair(tokens: list[int], pair: tuple[int, int], new_id: int) -> list[int]:
    merged: list[int] = []
    index = 0
    while index < len(tokens):
        if index < len(tokens) - 1 and (tokens[index], tokens[index + 1]) == pair:
            merged.append(new_id)
            index += 2
        else:
            merged.append(tokens[index])
            index += 1
    return merged


class MiniBPE:
    """Quelques fusions BPE apprises sur un corpus caractère. Les égalités sont départagées par l'ordre des ids."""

    def __init__(self, corpus: str, num_merges: int):
        if num_merges < 0:
            raise ValueError("num_merges doit être positif ou nul")
        self.base = CharTokenizer(corpus)
        self.merges: list[tuple[tuple[int, int], int]] = []
        tokens = self.base.encode(corpus)
        next_id = self.base.vocab_size
        for _ in range(num_merges):
            counts = pair_counts(tokens)
            if not counts:
                break
            pair = max(counts, key=lambda item: (counts[item], -item[0], -item[1]))
            tokens = merge_pair(tokens, pair, next_id)
            self.merges.append((pair, next_id))
            next_id += 1
        self.vocab_size = next_id

    def encode(self, text: str) -> list[int]:
        tokens = self.base.encode(text)
        for pair, new_id in self.merges:
            tokens = merge_pair(tokens, pair, new_id)
        return tokens

    def decode(self, ids: list[int]) -> str:
        expanded = [int(index) for index in ids]
        for pair, new_id in reversed(self.merges):
            expanded = [part for index in expanded for part in (pair if index == new_id else (index,))]
        return self.base.decode(expanded)
