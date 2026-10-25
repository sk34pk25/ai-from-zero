"""Entraîne TinyGPT avec l'autograd NumPy, AdamW, et un corpus français.

Le graphe couvre le decoder standard : embeddings de tokens et de positions,
plusieurs blocs (LayerNorm, attention causale multi-têtes, MLP GELU, résidus)
et une tête de langage. RoPE, RMSNorm, SwiGLU et GQA restent des forwards.
"""

from __future__ import annotations

import argparse
import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np

from model.autograd import Tensor, cross_entropy, embedding, layernorm
from model.mathutil import cross_entropy as numpy_cross_entropy
from model.tokenizer import CharTokenizer
from model.transformer import GPTConfig, TinyGPT, generate


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CORPUS = Path(__file__).resolve().parent / "data" / "francais.txt"
DEFAULT_CHECKPOINT = Path(__file__).resolve().parent / "data" / "gpt_checkpoint.npz"
DEFAULT_REPORT = ROOT / "data" / "gpt_run.json"


def assert_trainable(config: GPTConfig) -> None:
    if config.pos != "absolute" or config.norm != "layer" or config.ffn != "gelu":
        raise ValueError("l'entraînement couvre positions absolues, LayerNorm et GELU")
    if config.n_kv_heads not in (None, config.n_heads):
        raise ValueError("l'entraînement couvre l'attention multi-têtes complète, pas le GQA")
    if config.tie_weights:
        raise ValueError("l'entraînement ne partage pas encore la tête et l'embedding")


def bind_parameters(model: TinyGPT) -> dict[str, Tensor]:
    assert_trainable(model.config)
    bound: dict[str, Tensor] = {}
    for name, value in model.params.items():
        tensor = Tensor(np.array(value, dtype=np.float64, copy=True))
        model.params[name] = tensor.data
        bound[name] = tensor
    return bound


def _causal_fill(scores: Tensor) -> Tensor:
    time = scores.data.shape[-1]
    allowed = np.tril(np.ones((time, time), dtype=bool))
    filled = np.where(allowed, scores.data, -1e9)

    def backward() -> None:
        if scores.requires_grad:
            scores.grad += np.where(allowed, result.grad, 0.0)

    result = Tensor(filled, requires_grad=scores.requires_grad)
    result._prev = (scores,) if scores.requires_grad else ()
    result._backward = backward
    return result


def _attention_block(hidden: Tensor, params: dict[str, Tensor], layer: int, config: GPTConfig) -> Tensor:
    batch, time, _ = hidden.data.shape
    heads = config.n_heads
    head_dim = config.head_dim
    prefix = f"l{layer}"
    query = hidden.matmul(params[f"{prefix}.wq"]).reshape(batch, time, heads, head_dim).permute((0, 2, 1, 3))
    key = hidden.matmul(params[f"{prefix}.wk"]).reshape(batch, time, heads, head_dim).permute((0, 2, 1, 3))
    value = hidden.matmul(params[f"{prefix}.wv"]).reshape(batch, time, heads, head_dim).permute((0, 2, 1, 3))
    scores = query.matmul(key.permute((0, 1, 3, 2))) * (float(head_dim) ** -0.5)
    weights = _causal_fill(scores).softmax(axis=-1)
    context = weights.matmul(value).permute((0, 2, 1, 3)).reshape(batch, time, config.d_model)
    return context.matmul(params[f"{prefix}.wo"])


def _mlp_block(hidden: Tensor, params: dict[str, Tensor], layer: int) -> Tensor:
    prefix = f"l{layer}"
    return hidden.matmul(params[f"{prefix}.w1"]).gelu().matmul(params[f"{prefix}.w2"])


def logits_tensor(params: dict[str, Tensor], idx: np.ndarray, config: GPTConfig) -> Tensor:
    tokens = np.asarray(idx, dtype=np.int64)
    if tokens.ndim != 2:
        raise ValueError("idx doit avoir la forme (batch, temps)")
    _, time = tokens.shape
    if time > config.block_size:
        raise ValueError("la séquence dépasse block_size")
    hidden = embedding(params["tok"], tokens) + embedding(params["pos"], np.arange(time))
    for layer in range(config.n_layers):
        normed = layernorm(hidden, params[f"l{layer}.n1g"], params[f"l{layer}.n1b"])
        hidden = hidden + _attention_block(normed, params, layer, config)
        normed = layernorm(hidden, params[f"l{layer}.n2g"], params[f"l{layer}.n2b"])
        hidden = hidden + _mlp_block(normed, params, layer)
    hidden = layernorm(hidden, params["nfg"], params["nfb"])
    return hidden.matmul(params["head"])


def sequence_loss(params: dict[str, Tensor], batch: np.ndarray, config: GPTConfig) -> Tensor:
    """batch (B, T) : chaque position prédit la suivante."""
    window = np.asarray(batch, dtype=np.int64)
    if window.ndim != 2 or window.shape[1] < 2:
        raise ValueError("un batch d'entraînement a la forme (B, T) avec T >= 2")
    logits = logits_tensor(params, window[:, :-1], config)
    flat = logits.reshape(-1, config.vocab_size)
    return cross_entropy(flat, window[:, 1:].reshape(-1))


def numpy_sequence_loss(model: TinyGPT, batch: np.ndarray) -> float:
    window = np.asarray(batch, dtype=np.int64)
    logits, _ = model.forward(window[:, :-1])
    return float(numpy_cross_entropy(logits.reshape(-1, model.config.vocab_size), window[:, 1:].reshape(-1)))


class AdamW:
    """AdamW découplé. La décroissance de poids ne touche pas les vecteurs (normes, biais)."""

    def __init__(self, params: dict[str, Tensor], lr: float = 3e-3, betas: tuple[float, float] = (0.9, 0.95), eps: float = 1e-8, weight_decay: float = 0.01):
        if lr <= 0:
            raise ValueError("le pas d'apprentissage doit être positif")
        self.params = params
        self.lr = lr
        self.betas = betas
        self.eps = eps
        self.weight_decay = weight_decay
        self.step_index = 0
        self.moment = {name: np.zeros_like(tensor.data) for name, tensor in params.items()}
        self.velocity = {name: np.zeros_like(tensor.data) for name, tensor in params.items()}

    def step(self, clip: float = 1.0) -> None:
        beta1, beta2 = self.betas
        self.step_index += 1
        squared = 0.0
        grads: dict[str, np.ndarray] = {}
        for name, tensor in self.params.items():
            if tensor.grad is None:
                raise ValueError(f"gradient absent pour {name}")
            grad = np.array(tensor.grad, dtype=np.float64, copy=True)
            grads[name] = grad
            squared += float(np.square(grad).sum())
        norm = float(np.sqrt(squared))
        scale = 1.0 if norm <= clip or clip <= 0 else clip / norm
        for name, tensor in self.params.items():
            grad = grads[name] * scale
            self.moment[name] = beta1 * self.moment[name] + (1.0 - beta1) * grad
            self.velocity[name] = beta2 * self.velocity[name] + (1.0 - beta2) * np.square(grad)
            moment = self.moment[name] / (1.0 - beta1**self.step_index)
            velocity = self.velocity[name] / (1.0 - beta2**self.step_index)
            update = moment / (np.sqrt(velocity) + self.eps)
            if self.weight_decay and tensor.data.ndim >= 2:
                tensor.data *= 1.0 - self.lr * self.weight_decay
            tensor.data -= self.lr * update


def split_ids(ids: np.ndarray, val_ratio: float = 0.1) -> tuple[np.ndarray, np.ndarray]:
    if not 0 < val_ratio < 0.5:
        raise ValueError("val_ratio doit être entre 0 et 0.5")
    cut = max(1, min(len(ids) - 1, int(len(ids) * (1.0 - val_ratio))))
    return ids[:cut], ids[cut:]


def sample_batch(ids: np.ndarray, block: int, batch: int, rng: np.random.Generator) -> np.ndarray:
    if len(ids) <= block:
        raise ValueError("le corpus est plus court que le bloc")
    starts = rng.integers(0, len(ids) - block, size=batch)
    return np.stack([ids[start : start + block + 1] for start in starts])


def corpus_loss(model: TinyGPT, ids: np.ndarray, block: int) -> float:
    if len(ids) <= block:
        raise ValueError("pas assez de tokens pour évaluer")
    losses: list[float] = []
    weights: list[int] = []
    start = 0
    while start + block < len(ids):
        window = ids[start : start + block + 1][None, :]
        losses.append(numpy_sequence_loss(model, window))
        weights.append(block)
        start += block
    return float(np.average(losses, weights=weights))


def clip_prompt(tokenizer: CharTokenizer, prompt: str, block: int) -> np.ndarray:
    ids = tokenizer.encode(prompt)
    if not ids:
        raise ValueError("le prompt est vide")
    return np.asarray(ids[-block:], dtype=np.int64)[None, :]


def sample_text(model: TinyGPT, tokenizer: CharTokenizer, prompt: str, steps: int, temperature: float = 0.8, top_k: int | None = 10, seed: int = 0) -> str:
    prompt_ids = clip_prompt(tokenizer, prompt, model.config.block_size)
    tokens = generate(model, prompt_ids, steps, np.random.default_rng(seed), temperature=temperature, top_k=top_k)
    return tokenizer.decode(tokens[0].tolist())


def save_checkpoint(path: Path, model: TinyGPT, tokenizer: CharTokenizer, history: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload: dict[str, np.ndarray] = {}
    for name, value in model.params.items():
        payload["p_" + name.replace(".", "__")] = np.asarray(value, dtype=np.float64)
    meta = {
        "config": asdict(model.config),
        "stoi": tokenizer.stoi,
        "history": history,
    }
    payload["meta"] = np.asarray(json.dumps(meta, ensure_ascii=False))
    np.savez_compressed(path, **payload)


def load_checkpoint(path: Path) -> tuple[TinyGPT, CharTokenizer, dict]:
    archive = np.load(path, allow_pickle=False)
    meta = json.loads(archive["meta"].item())
    config = GPTConfig(**meta["config"])
    model = TinyGPT(config)
    for name in model.params:
        key = "p_" + name.replace(".", "__")
        model.params[name] = np.asarray(archive[key], dtype=np.float64)
    tokenizer = CharTokenizer.from_stoi({str(char): int(index) for char, index in meta["stoi"].items()})
    return model, tokenizer, meta["history"]


@dataclass
class GPTTrainResult:
    train_loss_start: float
    train_loss_end: float
    val_loss_start: float
    val_loss_end: float
    batch_losses: list[float]
    val_losses: list[float]
    val_steps: list[int]
    seconds: float
    steps: int
    samples: list[dict]
    attention: dict
    parameter_count: int
    vocab_size: int
    dataset_chars: int
    train_tokens: int
    val_tokens: int
    config: dict


def _attention_snapshot(model: TinyGPT, tokenizer: CharTokenizer, prompt: str) -> dict:
    model.keep_attention = True
    try:
        ids = clip_prompt(tokenizer, prompt, model.config.block_size)
        model.forward(ids)
        weights = np.asarray(model._last_weights[0][0, 0], dtype=np.float64)
    finally:
        model.keep_attention = False
    tokens = [tokenizer.itos[int(index)] for index in ids[0]]
    last = weights[-1]
    return {
        "prompt": tokenizer.decode(ids[0].tolist()),
        "layer": 0,
        "head": 0,
        "tokens": tokens,
        "last_row": [round(float(value), 4) for value in last],
        "matrix": [[round(float(value), 4) for value in row] for row in weights],
    }


def train_gpt(
    text: str,
    steps: int = 40,
    lr: float = 3e-3,
    batch: int = 8,
    block: int = 32,
    d_model: int = 32,
    n_heads: int = 4,
    n_layers: int = 2,
    seed: int = 0,
    weight_decay: float = 0.01,
    val_every: int = 20,
    sample: bool = True,
) -> tuple[TinyGPT, CharTokenizer, GPTTrainResult]:
    if steps < 2:
        raise ValueError("au moins deux pas pour comparer le début et la fin")
    tokenizer = CharTokenizer(text)
    ids = np.asarray(tokenizer.encode(text), dtype=np.int64)
    train_ids, val_ids = split_ids(ids)
    if len(val_ids) <= block or len(train_ids) <= block:
        raise ValueError("train et val doivent contenir plus d'un bloc")
    config = GPTConfig(
        vocab_size=tokenizer.vocab_size,
        d_model=d_model,
        n_heads=n_heads,
        n_layers=n_layers,
        block_size=block,
        ffn="gelu",
        norm="layer",
        pos="absolute",
        seed=seed,
    )
    model = TinyGPT(config)
    params = bind_parameters(model)
    optimizer = AdamW(params, lr=lr, weight_decay=weight_decay)
    rng = np.random.default_rng(seed)
    train_start = corpus_loss(model, train_ids, block)
    val_start = corpus_loss(model, val_ids, block)
    batch_losses: list[float] = []
    val_losses: list[float] = []
    val_steps: list[int] = []
    started = time.perf_counter()
    for step in range(steps):
        for tensor in params.values():
            tensor.zero_grad()
        window = sample_batch(train_ids, block, batch, rng)
        loss = sequence_loss(params, window, config)
        loss.backward()
        optimizer.step()
        batch_losses.append(float(loss.data))
        if step % val_every == 0 or step == steps - 1:
            val_losses.append(corpus_loss(model, val_ids, block))
            val_steps.append(step)
    seconds = time.perf_counter() - started
    train_end = corpus_loss(model, train_ids, block)
    val_end = corpus_loss(model, val_ids, block)
    samples: list[dict] = []
    attention = {"prompt": "", "layer": 0, "head": 0, "tokens": [], "last_row": [], "matrix": []}
    if sample:
        for prompt, temperature, top_k in (("le chat ", 0.8, 8), ("le chien ", 0.6, 5), ("le loup ", 0.3, 3)):
            if any(char not in tokenizer.stoi for char in prompt):
                continue
            samples.append({
                "prompt": prompt,
                "temperature": temperature,
                "top_k": top_k,
                "text": sample_text(model, tokenizer, prompt, steps=96, temperature=temperature, top_k=top_k, seed=seed),
            })
        probe = "le chat " if all(char in tokenizer.stoi for char in "le chat ") else text[:12]
        attention = _attention_snapshot(model, tokenizer, probe)
    result = GPTTrainResult(
        train_loss_start=train_start,
        train_loss_end=train_end,
        val_loss_start=val_start,
        val_loss_end=val_end,
        batch_losses=batch_losses,
        val_losses=val_losses,
        val_steps=val_steps,
        seconds=seconds,
        steps=steps,
        samples=samples,
        attention=attention,
        parameter_count=model.parameter_count(),
        vocab_size=tokenizer.vocab_size,
        dataset_chars=len(text),
        train_tokens=int(train_ids.size),
        val_tokens=int(val_ids.size),
        config=asdict(config),
    )
    return model, tokenizer, result


def result_payload(result: GPTTrainResult, corpus: str) -> dict:
    return {
        "label": "Entraînement réel sur CPU, autograd NumPy, AdamW. Ce n'est pas une courbe dessinée.",
        "corpus": corpus,
        "dataset_chars": result.dataset_chars,
        "train_tokens": result.train_tokens,
        "val_tokens": result.val_tokens,
        "vocab_size": result.vocab_size,
        "parameter_count": result.parameter_count,
        "steps": result.steps,
        "seconds": round(result.seconds, 1),
        "train_loss_start": result.train_loss_start,
        "train_loss_end": result.train_loss_end,
        "val_loss_start": result.val_loss_start,
        "val_loss_end": result.val_loss_end,
        "batch_losses": [round(value, 4) for value in result.batch_losses],
        "val_losses": [round(value, 4) for value in result.val_losses],
        "val_steps": result.val_steps,
        "samples": result.samples,
        "attention": result.attention,
        "config": result.config,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Entraîne le petit GPT français du dépôt.")
    parser.add_argument("--steps", type=int, default=300)
    parser.add_argument("--data", type=Path, default=DEFAULT_CORPUS)
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--block", type=int, default=32)
    parser.add_argument("--d-model", type=int, default=32)
    parser.add_argument("--layers", type=int, default=2)
    parser.add_argument("--heads", type=int, default=4)
    parser.add_argument("--lr", type=float, default=3e-3)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()
    text = args.data.read_text(encoding="utf-8")
    model, tokenizer, result = train_gpt(
        text,
        steps=args.steps,
        lr=args.lr,
        batch=args.batch,
        block=args.block,
        d_model=args.d_model,
        n_heads=args.heads,
        n_layers=args.layers,
        seed=args.seed,
    )
    history = result_payload(result, str(args.data.relative_to(ROOT) if args.data.is_relative_to(ROOT) else args.data))
    save_checkpoint(args.checkpoint, model, tokenizer, history)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(history, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        f"train {result.train_loss_start:.3f} -> {result.train_loss_end:.3f} | "
        f"val {result.val_loss_start:.3f} -> {result.val_loss_end:.3f} | "
        f"{result.seconds:.1f}s | {result.parameter_count} paramètres"
    )
    for sample in result.samples:
        print("---", sample["prompt"], sample["temperature"], sample["top_k"])
        print(sample["text"])


if __name__ == "__main__":
    main()
