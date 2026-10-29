"""Mini-GPT decoder-only, sans nn.Transformer.

Les variantes modernes (RoPE, RMSNorm, SwiGLU, GQA, weight tying) sont des options
du même module : c'est le fil rouge des niveaux 4 et 5.

Toutes ces options s'entraînent : model.gpt_train reconstruit le même forward
avec l'autograd NumPy (RoPE, GQA, SwiGLU et poids partagés compris).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from model.attention import apply_rope, repeat_kv, rope_cos_sin
from model.bigram import sample_logits
from model.mathutil import cross_entropy, gelu, layernorm, rmsnorm, silu


@dataclass(frozen=True)
class GPTConfig:
    vocab_size: int
    d_model: int = 32
    n_heads: int = 4
    n_kv_heads: int | None = None
    n_layers: int = 2
    block_size: int = 32
    ffn: str = "gelu"
    norm: str = "layer"
    pos: str = "absolute"
    tie_weights: bool = False
    seed: int = 0

    def __post_init__(self) -> None:
        if self.d_model % self.n_heads != 0:
            raise ValueError("d_model doit être divisible par n_heads")
        if self.kv_heads <= 0 or self.n_heads % self.kv_heads != 0:
            raise ValueError("n_heads doit être divisible par n_kv_heads")
        if self.ffn not in {"gelu", "swiglu"}:
            raise ValueError(self.ffn)
        if self.norm not in {"layer", "rms"}:
            raise ValueError(self.norm)
        if self.pos not in {"absolute", "rope"}:
            raise ValueError(self.pos)
        if self.head_dim % 2 != 0 and self.pos == "rope":
            raise ValueError("RoPE demande un head_dim pair")

    @property
    def kv_heads(self) -> int:
        return self.n_heads if self.n_kv_heads is None else self.n_kv_heads

    @property
    def head_dim(self) -> int:
        return self.d_model // self.n_heads


def _randn(rng: np.random.Generator, *shape: int) -> np.ndarray:
    return rng.normal(0.0, 0.02, size=shape)


class TinyGPT:
    def __init__(self, config: GPTConfig):
        self.config = config
        rng = np.random.default_rng(config.seed)
        d_model = config.d_model
        kv_dim = config.kv_heads * config.head_dim
        hidden = d_model * 4 if config.ffn == "gelu" else d_model * 2
        self.params: dict[str, np.ndarray] = {"tok": _randn(rng, config.vocab_size, d_model)}
        if config.pos == "absolute":
            self.params["pos"] = _randn(rng, config.block_size, d_model)
        for layer in range(config.n_layers):
            prefix = f"l{layer}"
            self.params[f"{prefix}.wq"] = _randn(rng, d_model, d_model)
            self.params[f"{prefix}.wk"] = _randn(rng, d_model, kv_dim)
            self.params[f"{prefix}.wv"] = _randn(rng, d_model, kv_dim)
            self.params[f"{prefix}.wo"] = _randn(rng, d_model, d_model)
            self.params[f"{prefix}.n1g"] = np.ones(d_model)
            self.params[f"{prefix}.n2g"] = np.ones(d_model)
            if config.norm == "layer":
                self.params[f"{prefix}.n1b"] = np.zeros(d_model)
                self.params[f"{prefix}.n2b"] = np.zeros(d_model)
            if config.ffn == "gelu":
                self.params[f"{prefix}.w1"] = _randn(rng, d_model, hidden)
                self.params[f"{prefix}.w2"] = _randn(rng, hidden, d_model)
            else:
                self.params[f"{prefix}.wg"] = _randn(rng, d_model, hidden)
                self.params[f"{prefix}.wu"] = _randn(rng, d_model, hidden)
                self.params[f"{prefix}.wd"] = _randn(rng, hidden, d_model)
        self.params["nfg"] = np.ones(d_model)
        if config.norm == "layer":
            self.params["nfb"] = np.zeros(d_model)
        if not config.tie_weights:
            self.params["head"] = _randn(rng, d_model, config.vocab_size)

    def parameter_count(self) -> int:
        return int(sum(array.size for array in self.params.values()))

    def forward(self, idx: np.ndarray, cache: list[dict[str, np.ndarray]] | None = None):
        tokens = np.asarray(idx, dtype=np.int64)
        if tokens.ndim != 2:
            raise ValueError("idx doit avoir la forme (batch, temps)")
        batch, time = tokens.shape
        past = 0 if cache is None else int(cache[0]["k"].shape[2])
        if past + time > self.config.block_size:
            raise ValueError("la séquence dépasse block_size")
        hidden = self.params["tok"][tokens]
        positions = np.arange(past, past + time)
        if self.config.pos == "absolute":
            hidden = hidden + self.params["pos"][positions]
        if getattr(self, "keep_attention", False):
            self._last_weights = []
        new_cache: list[dict[str, np.ndarray]] = []
        for layer in range(self.config.n_layers):
            attended, keys, values = self._attention(self._norm(hidden, layer, 1), layer, positions, None if cache is None else cache[layer])
            hidden = hidden + attended
            hidden = hidden + self._ffn(self._norm(hidden, layer, 2), layer)
            new_cache.append({"k": keys, "v": values})
        hidden = self._final_norm(hidden)
        if self.config.tie_weights:
            logits = hidden @ self.params["tok"].T
        else:
            logits = hidden @ self.params["head"]
        return logits, new_cache

    def loss(self, idx: np.ndarray, targets: np.ndarray) -> float:
        logits, _ = self.forward(idx)
        flat = logits.reshape(-1, logits.shape[-1])
        return cross_entropy(flat, np.asarray(targets, dtype=np.int64).reshape(-1))

    def _norm(self, hidden: np.ndarray, layer: int, which: int) -> np.ndarray:
        gain = self.params[f"l{layer}.n{which}g"]
        if self.config.norm == "rms":
            return rmsnorm(hidden, gain)
        return layernorm(hidden, gain, self.params[f"l{layer}.n{which}b"])

    def _final_norm(self, hidden: np.ndarray) -> np.ndarray:
        if self.config.norm == "rms":
            return rmsnorm(hidden, self.params["nfg"])
        return layernorm(hidden, self.params["nfg"], self.params["nfb"])

    def _ffn(self, hidden: np.ndarray, layer: int) -> np.ndarray:
        prefix = f"l{layer}"
        if self.config.ffn == "gelu":
            return gelu(hidden @ self.params[f"{prefix}.w1"]) @ self.params[f"{prefix}.w2"]
        gated = silu(hidden @ self.params[f"{prefix}.wg"]) * (hidden @ self.params[f"{prefix}.wu"])
        return gated @ self.params[f"{prefix}.wd"]

    def _attention(self, hidden, layer, positions, cache_layer):
        config = self.config
        batch, time, _ = hidden.shape
        heads = config.n_heads
        head_dim = config.head_dim
        prefix = f"l{layer}"
        query = hidden @ self.params[f"{prefix}.wq"]
        key = hidden @ self.params[f"{prefix}.wk"]
        value = hidden @ self.params[f"{prefix}.wv"]
        query = query.reshape(batch, time, heads, head_dim).transpose(0, 2, 1, 3)
        key = key.reshape(batch, time, config.kv_heads, head_dim).transpose(0, 2, 1, 3)
        value = value.reshape(batch, time, config.kv_heads, head_dim).transpose(0, 2, 1, 3)
        if config.pos == "rope":
            cos, sin = rope_cos_sin(positions, head_dim)
            query = apply_rope(query, cos, sin)
            key = apply_rope(key, cos, sin)
        if cache_layer is not None:
            key = np.concatenate([cache_layer["k"], key], axis=2)
            value = np.concatenate([cache_layer["v"], value], axis=2)
        key_for_attn = repeat_kv(key, heads // config.kv_heads)
        value_for_attn = repeat_kv(value, heads // config.kv_heads)
        scores = (query @ key_for_attn.transpose(0, 1, 3, 2)) / np.sqrt(head_dim)
        allowed = np.arange(key.shape[2])[None, :] <= positions[:, None]
        scores = np.where(allowed, scores, -1e9)
        weights = _softmax_last(scores)
        if getattr(self, "keep_attention", False):
            self._last_weights.append(weights)
        context = weights @ value_for_attn
        context = context.transpose(0, 2, 1, 3).reshape(batch, time, heads * head_dim)
        return context @ self.params[f"{prefix}.wo"], key, value


def _softmax_last(scores: np.ndarray) -> np.ndarray:
    shifted = scores - np.max(scores, axis=-1, keepdims=True)
    exp = np.exp(shifted)
    return exp / np.sum(exp, axis=-1, keepdims=True)


def generate(model: TinyGPT, idx: np.ndarray, steps: int, rng: np.random.Generator, temperature: float = 1.0, top_k: int | None = None) -> np.ndarray:
    tokens = np.asarray(idx, dtype=np.int64)
    for _ in range(steps):
        window = tokens[:, -model.config.block_size :]
        logits, _ = model.forward(window)
        nxt = sample_logits(logits[:, -1, :], rng, temperature=temperature, top_k=top_k)
        tokens = np.concatenate([tokens, nxt[:, None]], axis=1)
    return tokens
