"""Entraînement pas à pas pour le navigateur.

Chaque appel à step() fait un seul lot. L'interface peut s'arrêter entre
deux pas sans tuer le calcul au milieu d'une rétropropagation.
"""

from __future__ import annotations

import numpy as np

from model.gpt_train import AdamW, bind_parameters, sample_text, sequence_loss
from model.tokenizer import CharTokenizer
from model.transformer import GPTConfig, TinyGPT


class LiveTrainer:
    def __init__(self, text: str, steps: int = 20, lr: float = 0.05, batch: int = 4, block: int = 16, d_model: int = 16, n_heads: int = 2, n_layers: int = 1, seed: int = 0):
        if steps < 1:
            raise ValueError("au moins un pas")
        self.text = text
        self.steps = int(steps)
        self.block = int(block)
        self.batch = int(batch)
        self.tokenizer = CharTokenizer(text)
        self.config = GPTConfig(
            vocab_size=self.tokenizer.vocab_size,
            d_model=d_model,
            n_heads=n_heads,
            n_layers=n_layers,
            block_size=block,
            seed=seed,
        )
        self.model = TinyGPT(self.config)
        self.params = bind_parameters(self.model)
        self.optimizer = AdamW(self.params, lr=lr, weight_decay=0.0)
        self.rng = np.random.default_rng(seed)
        self.step_index = 0
        self.losses: list[float] = []

    def info(self) -> dict:
        return {
            "steps": self.steps,
            "parameters": self.model.parameter_count(),
            "vocab": self.tokenizer.vocab_size,
            "block": self.block,
        }

    def step(self) -> dict:
        if self.step_index >= self.steps:
            return {"step": self.step_index, "loss": self.losses[-1] if self.losses else 0.0, "done": True, "total": self.steps}
        for tensor in self.params.values():
            tensor.zero_grad()
        ids = np.asarray(self.tokenizer.encode(self.text), dtype=np.int64)
        if len(ids) <= self.block:
            raise ValueError("le texte de démo est plus court que le bloc")
        starts = self.rng.integers(0, len(ids) - self.block, size=self.batch)
        window = np.stack([ids[start : start + self.block + 1] for start in starts])
        loss = sequence_loss(self.params, window, self.config)
        loss.backward()
        self.optimizer.step()
        self.step_index += 1
        value = float(loss.data)
        self.losses.append(value)
        return {"step": self.step_index, "loss": value, "done": self.step_index >= self.steps, "total": self.steps}

    def sample(self, prompt: str, n: int = 24, temperature: float = 0.8, top_k: int = 5, seed: int = 0) -> str:
        safe = "".join(char if char in self.tokenizer.stoi else " " for char in prompt) or self.text[:8]
        return sample_text(self.model, self.tokenizer, safe, n, temperature=temperature, top_k=top_k, seed=seed)
