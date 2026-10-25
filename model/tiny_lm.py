"""Petit modèle de langage entraîné avec model.autograd.

Le fil rouge s'arrête ici à quelque chose que tu peux lancer : un tokenizer
caractère, une perte, une descente, puis un échantillon. L'attention causale
est optionnelle et son gradient traverse vraiment le softmax et les produits.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from model.autograd import Tensor, causal_attention, cross_entropy, embedding
from model.tokenizer import CharTokenizer


@dataclass
class TrainResult:
    loss_start: float
    loss_end: float
    losses: list[float]
    generated: str
    steps: int
    attention: bool
    vocab_size: int


class TinyLM:
    def __init__(self, vocab_size: int, d_model: int = 8, seed: int = 0, attention: bool = False):
        if vocab_size < 1:
            raise ValueError("vocab_size doit être positif")
        if d_model < 1:
            raise ValueError("d_model doit être positif")
        self.vocab_size = vocab_size
        self.d_model = d_model
        self.attention = attention
        rng = np.random.default_rng(seed)
        self.embed = Tensor(rng.normal(0.0, 0.02, size=(vocab_size, d_model)))
        self.head = Tensor(rng.normal(0.0, 0.02, size=(d_model, vocab_size)))
        if attention:
            scale = 0.02
            self.wq = Tensor(rng.normal(0.0, scale, size=(d_model, d_model)))
            self.wk = Tensor(rng.normal(0.0, scale, size=(d_model, d_model)))
            self.wv = Tensor(rng.normal(0.0, scale, size=(d_model, d_model)))
        else:
            self.wq = self.wk = self.wv = None

    def parameters(self) -> list[Tensor]:
        params = [self.embed, self.head]
        if self.attention:
            params.extend([self.wq, self.wk, self.wv])
        return params

    def loss(self, ids: list[int] | np.ndarray) -> Tensor:
        sequence = [int(index) for index in ids]
        if len(sequence) < 2:
            raise ValueError("il faut au moins deux tokens")
        if any(index < 0 or index >= self.vocab_size for index in sequence):
            raise IndexError("identifiant hors vocabulaire")
        hidden = embedding(self.embed, np.asarray(sequence[:-1], dtype=np.int64))
        if self.attention:
            hidden = hidden + causal_attention(hidden, self.wq, self.wk, self.wv)
        logits = hidden.matmul(self.head)
        return cross_entropy(logits, np.asarray(sequence[1:], dtype=np.int64))

    def step(self, ids: list[int] | np.ndarray, lr: float) -> float:
        if lr <= 0:
            raise ValueError("le pas d'apprentissage doit être positif")
        for param in self.parameters():
            param.zero_grad()
        loss = self.loss(ids)
        loss.backward()
        for param in self.parameters():
            np.clip(param.grad, -5.0, 5.0, out=param.grad)
            param.data -= lr * param.grad
        return float(loss.data)

    def logits(self, ids: list[int]) -> np.ndarray:
        """Scores du prochain token pour chaque position, sans suivre le gradient."""
        for param in self.parameters():
            param.requires_grad = False
        try:
            hidden = embedding(self.embed, np.asarray(ids, dtype=np.int64))
            if self.attention:
                hidden = hidden + causal_attention(hidden, self.wq, self.wk, self.wv)
            return hidden.matmul(self.head).data
        finally:
            for param in self.parameters():
                param.requires_grad = True
                param.zero_grad()

    def generate(self, prompt: list[int], steps: int, rng: np.random.Generator | None = None) -> list[int]:
        if steps < 0:
            raise ValueError("steps doit être positif ou nul")
        random = rng or np.random.default_rng(0)
        tokens = [int(index) for index in prompt]
        if not tokens:
            raise ValueError("le prompt est vide")
        for _ in range(steps):
            scores = self.logits(tokens)[-1]
            scores = scores - np.max(scores)
            probs = np.exp(scores)
            probs /= probs.sum()
            tokens.append(int(random.choice(self.vocab_size, p=probs)))
        return tokens


def train_tiny_lm(
    text: str,
    steps: int = 40,
    lr: float = 0.4,
    d_model: int = 8,
    seed: int = 0,
    attention: bool = False,
) -> TrainResult:
    """Entraîne sur un texte entier, puis génère une courte suite."""
    if steps < 2:
        raise ValueError("au moins deux pas pour comparer le début et la fin")
    tokenizer = CharTokenizer(text)
    ids = tokenizer.encode(text)
    model = TinyLM(tokenizer.vocab_size, d_model=d_model, seed=seed, attention=attention)
    losses = [model.step(ids, lr) for _ in range(steps)]
    rng = np.random.default_rng(seed)
    generated = tokenizer.decode(model.generate([ids[0]], 12, rng))
    return TrainResult(
        loss_start=losses[0],
        loss_end=losses[-1],
        losses=losses,
        generated=generated,
        steps=steps,
        attention=attention,
        vocab_size=tokenizer.vocab_size,
    )
