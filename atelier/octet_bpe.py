"""BPE sur les 256 octets UTF-8, écrit ici sans tokenizer préfabriqué.

Les frontières de documents ne sont jamais fusionnées. Les chaînes littérales
<eos> restent du texte : seuls les arguments bos/eos insèrent des tokens spéciaux.
"""

from collections import Counter
import json
from pathlib import Path


class ByteBPETokenizer:
    BOS, EOS, PAD = 256, 257, 258

    def __init__(self, merges=()):
        self.merges = []
        self.pieces = {i: bytes([i]) for i in range(256)}
        for pair in merges:
            if not isinstance(pair, (list, tuple)) or len(pair) != 2:
                raise ValueError("Fusion invalide")
            a, b = pair
            if (
                type(a) is not int
                or type(b) is not int
                or a not in self.pieces
                or b not in self.pieces
            ):
                raise ValueError(
                    "Une fusion doit référencer deux tokens d'octets déjà définis"
                )
            token = 259 + len(self.merges)
            self.pieces[token] = self.pieces[a] + self.pieces[b]
            self.merges.append((a, b))

    @property
    def vocab_size(self):
        return 259 + len(self.merges)

    @staticmethod
    def _fusion(ids, pair, token):
        result, i = [], 0
        while i < len(ids):
            if i + 1 < len(ids) and (ids[i], ids[i + 1]) == pair:
                result.append(token)
                i += 2
            else:
                result.append(ids[i])
                i += 1
        return result

    @classmethod
    def train(cls, texts, merges=64, **_):
        if type(merges) is not int or merges < 0:
            raise ValueError("Nombre de fusions invalide")
        docs = [texts] if isinstance(texts, str) else list(texts)
        streams = [list(text.encode("utf-8")) for text in docs]
        pairs = []
        for i in range(merges):
            counts = Counter(pair for ids in streams for pair in zip(ids, ids[1:]))
            if not counts:
                break
            pair = min(counts, key=lambda p: (-counts[p], p))
            if counts[pair] < 2:
                break
            pairs.append(pair)
            streams = [cls._fusion(ids, pair, 259 + i) for ids in streams]
        return cls(pairs)

    def encode(self, text, bos=False, eos=False):
        ids = list(text.encode("utf-8"))
        for i, pair in enumerate(self.merges):
            ids = self._fusion(ids, pair, 259 + i)
        return ([self.BOS] if bos else []) + ids + ([self.EOS] if eos else [])

    def decode(self, ids, errors="strict", skip_special=True):
        if errors not in ("strict", "replace"):
            raise ValueError("Politique UTF-8 : strict ou replace")
        pieces = []
        for token in ids:
            token = int(token)
            if token in (self.BOS, self.EOS, self.PAD):
                if skip_special:
                    continue
                raise ValueError("Un token spécial n'est pas un octet UTF-8")
            if token not in self.pieces:
                raise ValueError("Identifiant de token inconnu")
            pieces.append(self.pieces[token])
        return b"".join(pieces).decode("utf-8", errors=errors)

    def to_dict(self):
        return {
            "kind": "byte-bpe",
            "version": 1,
            "merges": [list(p) for p in self.merges],
            "special": {"bos": self.BOS, "eos": self.EOS, "pad": self.PAD},
        }

    @classmethod
    def from_dict(cls, value):
        if (
            value.get("kind") != "byte-bpe"
            or value.get("version") != 1
            or value.get("special") != {"bos": 256, "eos": 257, "pad": 258}
        ):
            raise ValueError("Format BPE octets inconnu")
        return cls(value["merges"])

    def save(self, path):
        # Import différé : l'algorithme lui-même ne dépend que de Python.
        try:
            from .artifacts import ecrire_json
        except ImportError:
            from artifacts import ecrire_json
        ecrire_json(path, self.to_dict())

    @classmethod
    def load(cls, path):
        return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))
