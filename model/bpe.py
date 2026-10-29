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
    def train(
        cls, text: str, num_merges: int, on_merge=None, fallback: bool = False
    ) -> "BPETokenizer":
        if not text:
            raise ValueError("le corpus d'entraînement est vide")
        if num_merges < 0:
            raise ValueError("num_merges doit être positif ou nul")
        merges = _learn_merges(text, num_merges, on_merge)
        vocab = _vocab_from_merges(text, merges)
        if fallback and "�" not in vocab:
            vocab["�"] = len(vocab)
        return cls(vocab, merges)

    def encode(self, text: str) -> list[int]:
        unknown = sorted({char for char in text if char not in self.vocab})
        if unknown:
            raise KeyError(f"caractères absents du vocabulaire : {''.join(unknown)}")
        return _encode_with_merges(text, self.vocab, self.merges)

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
        destination.write_text(
            json.dumps(self.to_dict(), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    @classmethod
    def load(cls, path: str | Path) -> "BPETokenizer":
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls.from_dict(payload)


def _vocab_from_merges(text: str, merges: list[tuple[str, str]]) -> dict[str, int]:
    symbols = sorted(set(text))
    vocab = {symbol: index for index, symbol in enumerate(symbols)}
    for left, right in merges:
        vocab[left + right] = len(vocab)
    return vocab


def _learn_merges(text: str, num_merges: int, on_merge=None) -> list[tuple[str, str]]:
    """Mêmes fusions que le balayage naïf, sans reparcourir tout le texte à chaque pas."""
    import heapq

    symbols = sorted(set(text))
    itos = list(symbols)
    symbol_id = {symbol: index for index, symbol in enumerate(symbols)}
    state = _LinkState.from_text(text, symbol_id)
    heap: list[tuple] = []
    for pair, count in state.counts.items():
        heapq.heappush(heap, (-count, itos[pair[0]], itos[pair[1]], pair[0], pair[1]))
    merges: list[tuple[str, str]] = []
    for step in range(num_merges):
        chosen = _pop_best(heap, state.counts)
        if chosen is None:
            break
        left_id, right_id = chosen
        left, right = itos[left_id], itos[right_id]
        piece = left + right
        new_id = len(itos)
        itos.append(piece)
        state.apply(chosen, new_id)
        merges.append((left, right))
        for pair in state.affected:
            count = state.counts.get(pair, 0)
            if count > 0:
                heapq.heappush(
                    heap, (-count, itos[pair[0]], itos[pair[1]], pair[0], pair[1])
                )
        if on_merge is not None and (step + 1 == num_merges or (step + 1) % 200 == 0):
            on_merge(step + 1, len(merges))
    return merges


def _pop_best(
    heap: list[tuple], counts: dict[tuple[int, int], int]
) -> tuple[int, int] | None:
    import heapq

    while heap:
        negative, _left, _right, left_id, right_id = heapq.heappop(heap)
        pair = (left_id, right_id)
        current = counts.get(pair, 0)
        if current > 0 and current == -negative:
            return pair
    return None


def _encode_with_merges(
    text: str, vocab: dict[str, int], merges: list[tuple[str, str]]
) -> list[int]:
    if not text:
        return []
    state = _LinkState.from_text(text, vocab)
    for left, right in merges:
        piece = left + right
        state.apply((vocab[left], vocab[right]), vocab[piece])
    return state.ids()


class _LinkState:
    """Liste chaînée de jetons. Les comptes de paires suivent les fusions locales."""

    def __init__(
        self, tok: list[int], prev: list[int], nxt: list[int], alive: bytearray
    ):
        self.tok = tok
        self.prev = prev
        self.nxt = nxt
        self.alive = alive
        self.counts: dict[tuple[int, int], int] = {}
        self.where: dict[tuple[int, int], set[int]] = {}
        self.affected: set[tuple[int, int]] = set()
        for index in range(len(tok) - 1):
            self._inc((tok[index], tok[index + 1]), index)

    @classmethod
    def from_text(cls, text: str, symbol_id: dict[str, int]) -> "_LinkState":
        count = len(text)
        tok = [symbol_id[char] for char in text]
        prev = list(range(-1, count - 1))
        nxt = list(range(1, count + 1))
        if count:
            nxt[-1] = -1
        return cls(tok, prev, nxt, bytearray(b"\x01") * count)

    def _inc(self, pair: tuple[int, int], index: int) -> None:
        self.where.setdefault(pair, set()).add(index)
        self.counts[pair] = self.counts.get(pair, 0) + 1
        self.affected.add(pair)

    def _dec(self, pair: tuple[int, int], index: int) -> None:
        found = self.where.get(pair)
        if found is not None:
            found.discard(index)
        self.counts[pair] = self.counts.get(pair, 0) - 1
        if self.counts[pair] < 0:
            raise RuntimeError("compte de paire négatif")
        self.affected.add(pair)

    def apply(self, pair: tuple[int, int], new_id: int) -> None:
        left_id, right_id = pair
        self.affected = set()
        for index in sorted(self.where.get(pair, ())):
            if not self.alive[index]:
                continue
            nxt = self.nxt[index]
            if nxt < 0 or not self.alive[nxt]:
                continue
            if self.tok[index] != left_id or self.tok[nxt] != right_id:
                continue
            previous = self.prev[index]
            following = self.nxt[nxt]
            self._dec((self.tok[index], self.tok[nxt]), index)
            if previous >= 0:
                self._dec((self.tok[previous], self.tok[index]), previous)
            if following >= 0:
                self._dec((self.tok[nxt], self.tok[following]), nxt)
            self.tok[index] = new_id
            self.alive[nxt] = 0
            self.nxt[index] = following
            if following >= 0:
                self.prev[following] = index
            if previous >= 0:
                self._inc((self.tok[previous], self.tok[index]), previous)
            if following >= 0:
                self._inc((self.tok[index], self.tok[following]), index)
        stale = [key for key, count in self.counts.items() if count <= 0]
        for key in stale:
            self.counts.pop(key, None)
            self.where.pop(key, None)

    def ids(self) -> list[int]:
        if not self.tok:
            return []
        index = 0
        while self.prev[index] >= 0:
            index = self.prev[index]
        output = []
        while index >= 0:
            output.append(self.tok[index])
            index = self.nxt[index]
        return output


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


def reference_merges(text: str, num_merges: int) -> list[tuple[str, str]]:
    """Balayage simple, gardé pour vérifier que la version indexée choisit les mêmes paires."""
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
    return merges


def reference_encode(
    text: str, vocab: dict[str, int], merges: list[tuple[str, str]]
) -> list[int]:
    tokens = list(text)
    for pair in merges:
        tokens = _merge(tokens, pair)
    return [vocab[token] for token in tokens]


def pair_counts(tokens: list[str]) -> dict[tuple[str, str], int]:
    counts: dict[tuple[str, str], int] = {}
    for left, right in zip(tokens, tokens[1:]):
        pair = (left, right)
        counts[pair] = counts.get(pair, 0) + 1
    return counts
