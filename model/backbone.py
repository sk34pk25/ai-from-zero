"""Dos interchangeable : Transformer, SSM, ou hybride. La sortie reste (B, T, D)."""

from __future__ import annotations

import numpy as np

from model.attention import scaled_dot_product_attention
from model.ssm import selective_scan


class Backbone:
    def __init__(self, kind: str, vocab_size: int, d_model: int = 16, n_layers: int = 2, block_size: int = 24, seed: int = 0):
        if kind not in {"transformer", "ssm", "hybrid"}:
            raise ValueError(kind)
        if d_model < 2:
            raise ValueError("d_model trop petit")
        self.kind = kind
        self.vocab_size = vocab_size
        self.d_model = d_model
        self.n_layers = n_layers
        self.block_size = block_size
        rng = np.random.default_rng(seed)
        self.embed = rng.normal(0.0, 0.02, size=(vocab_size, d_model))
        self.layers = []
        for index in range(n_layers):
            if kind == "transformer":
                mode = "attn"
            elif kind == "ssm":
                mode = "ssm"
            else:
                mode = "attn" if index % 2 == 0 else "ssm"
            self.layers.append(
                {
                    "mode": mode,
                    "wq": rng.normal(0.0, 0.02, size=(d_model, d_model)),
                    "wk": rng.normal(0.0, 0.02, size=(d_model, d_model)),
                    "wv": rng.normal(0.0, 0.02, size=(d_model, d_model)),
                    "wo": rng.normal(0.0, 0.02, size=(d_model, d_model)),
                    "a": -np.exp(rng.normal(0.0, 0.1, size=(d_model,))),
                    "b": rng.normal(0.0, 0.02, size=(d_model, d_model)),
                    "c": rng.normal(0.0, 0.02, size=(d_model, d_model)),
                    "delta": rng.normal(0.0, 0.02, size=(d_model,)),
                    "in": rng.normal(0.0, 0.02, size=(d_model, d_model)),
                }
            )

    def forward(self, idx: np.ndarray) -> np.ndarray:
        tokens = np.asarray(idx, dtype=np.int64)
        if tokens.ndim != 2:
            raise ValueError("idx doit avoir la forme (batch, temps)")
        if tokens.shape[1] > self.block_size:
            raise ValueError("séquence plus longue que block_size")
        hidden = self.embed[tokens]
        for layer in self.layers:
            if layer["mode"] == "attn":
                hidden = hidden + self._attention(hidden, layer)
            else:
                hidden = hidden + self._ssm(hidden, layer)
        return hidden

    def _attention(self, hidden: np.ndarray, layer: dict) -> np.ndarray:
        batch, time, _ = hidden.shape
        outputs = np.empty_like(hidden)
        for index in range(batch):
            query = hidden[index] @ layer["wq"]
            key = hidden[index] @ layer["wk"]
            value = hidden[index] @ layer["wv"]
            context, _ = scaled_dot_product_attention(query, key, value, causal=True)
            outputs[index] = context @ layer["wo"]
        return outputs

    def _ssm(self, hidden: np.ndarray, layer: dict) -> np.ndarray:
        batch = hidden.shape[0]
        outputs = np.empty_like(hidden)
        # delta positif, une valeur par dimension d'état. softplus simplifié en sigmoid décalée.
        delta = 0.05 + 1.0 / (1.0 + np.exp(-(hidden * layer["delta"])))
        for index in range(batch):
            signal = hidden[index] @ layer["in"]
            scanned = selective_scan(
                signal,
                layer["a"],
                np.tanh(hidden[index] @ layer["b"]),
                np.tanh(hidden[index] @ layer["c"]),
                delta[index],
            )
            outputs[index] = scanned
        return outputs
