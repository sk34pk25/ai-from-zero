"""Entraîne TinyGPT avec l'autograd NumPy, AdamW, et un corpus français.

Le graphe couvre le decoder standard : embeddings de tokens et de positions,
plusieurs blocs (LayerNorm, attention causale multi-têtes, MLP GELU, résidus)
et une tête de langage. RMSNorm est également entraînable. RoPE, SwiGLU et GQA restent des forwards.
"""

from __future__ import annotations

import argparse
import hashlib
import platform
import json
import math
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np

from model.autograd import Tensor, cross_entropy, embedding, layernorm
from model.bpe import BPETokenizer
from model.byte_bpe import ByteBPETokenizer
from model.mathutil import cross_entropy as numpy_cross_entropy
from model.tokenizer import CharTokenizer
from model.transformer import GPTConfig, TinyGPT, generate


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CORPUS = Path(__file__).resolve().parent / "data" / "francais.txt"
DEFAULT_CHECKPOINT = ROOT / "runs" / "gpt_checkpoint.npz"
DEFAULT_REPORT = ROOT / "runs" / "gpt_run.json"


def assert_trainable(config: GPTConfig) -> None:
    if (
        config.pos != "absolute"
        or config.norm not in ("layer", "rms")
        or config.ffn != "gelu"
    ):
        raise ValueError(
            "l'entraînement couvre positions absolues, LayerNorm/RMSNorm et GELU"
        )
    if config.n_kv_heads not in (None, config.n_heads):
        raise ValueError(
            "l'entraînement couvre l'attention multi-têtes complète, pas le GQA"
        )
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


def _attention_block(
    hidden: Tensor, params: dict[str, Tensor], layer: int, config: GPTConfig
) -> Tensor:
    batch, time, _ = hidden.data.shape
    heads = config.n_heads
    head_dim = config.head_dim
    prefix = f"l{layer}"
    query = (
        hidden.matmul(params[f"{prefix}.wq"])
        .reshape(batch, time, heads, head_dim)
        .permute((0, 2, 1, 3))
    )
    key = (
        hidden.matmul(params[f"{prefix}.wk"])
        .reshape(batch, time, heads, head_dim)
        .permute((0, 2, 1, 3))
    )
    value = (
        hidden.matmul(params[f"{prefix}.wv"])
        .reshape(batch, time, heads, head_dim)
        .permute((0, 2, 1, 3))
    )
    scores = query.matmul(key.permute((0, 1, 3, 2))) * (float(head_dim) ** -0.5)
    weights = _causal_fill(scores).softmax(axis=-1)
    context = (
        weights.matmul(value).permute((0, 2, 1, 3)).reshape(batch, time, config.d_model)
    )
    return context.matmul(params[f"{prefix}.wo"])


def _mlp_block(hidden: Tensor, params: dict[str, Tensor], layer: int) -> Tensor:
    prefix = f"l{layer}"
    return hidden.matmul(params[f"{prefix}.w1"]).gelu().matmul(params[f"{prefix}.w2"])


def logits_tensor(
    params: dict[str, Tensor], idx: np.ndarray, config: GPTConfig
) -> Tensor:
    tokens = np.asarray(idx, dtype=np.int64)
    if tokens.ndim != 2:
        raise ValueError("idx doit avoir la forme (batch, temps)")
    _, time = tokens.shape
    if time > config.block_size:
        raise ValueError("la séquence dépasse block_size")
    hidden = embedding(params["tok"], tokens) + embedding(
        params["pos"], np.arange(time)
    )

    def normaliser(hidden, prefix):
        if config.norm == "rms":
            from model.autograd import rmsnorm

            return rmsnorm(hidden, params[prefix + "g"])
        return layernorm(hidden, params[prefix + "g"], params[prefix + "b"])

    for layer in range(config.n_layers):
        normed = normaliser(hidden, f"l{layer}.n1")
        hidden = hidden + _attention_block(normed, params, layer, config)
        normed = normaliser(hidden, f"l{layer}.n2")
        hidden = hidden + _mlp_block(normed, params, layer)
    hidden = normaliser(hidden, "nf")
    return hidden.matmul(params["head"])


def sequence_loss(
    params: dict[str, Tensor], batch: np.ndarray, config: GPTConfig
) -> Tensor:
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
    return float(
        numpy_cross_entropy(
            logits.reshape(-1, model.config.vocab_size), window[:, 1:].reshape(-1)
        )
    )


class AdamW:
    """AdamW découplé. La décroissance de poids ne touche pas les vecteurs (normes, biais)."""

    def __init__(
        self,
        params: dict[str, Tensor],
        lr: float = 3e-3,
        betas: tuple[float, float] = (0.9, 0.95),
        eps: float = 1e-8,
        weight_decay: float = 0.01,
    ):
        if lr <= 0:
            raise ValueError("le pas d'apprentissage doit être positif")
        self.params = params
        self.lr = lr
        self.betas = betas
        self.eps = eps
        self.weight_decay = weight_decay
        self.step_index = 0
        self.moment = {
            name: np.zeros_like(tensor.data) for name, tensor in params.items()
        }
        self.velocity = {
            name: np.zeros_like(tensor.data) for name, tensor in params.items()
        }

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
            self.velocity[name] = beta2 * self.velocity[name] + (
                1.0 - beta2
            ) * np.square(grad)
            moment = self.moment[name] / (1.0 - beta1**self.step_index)
            velocity = self.velocity[name] / (1.0 - beta2**self.step_index)
            update = moment / (np.sqrt(velocity) + self.eps)
            if self.weight_decay and tensor.data.ndim >= 2:
                tensor.data *= 1.0 - self.lr * self.weight_decay
            tensor.data -= self.lr * update


def scheduled_lr(
    step: int,
    total: int,
    base: float,
    warmup: int,
    schedule: str,
    min_ratio: float = 0.1,
) -> float:
    """Pas constant, ou montée linéaire puis décroissance cosinus jusqu'à min_ratio * base."""
    if base <= 0:
        raise ValueError("le pas d'apprentissage doit être positif")
    if schedule == "constant":
        return base
    if schedule != "cosine":
        raise ValueError("schedule doit être constant ou cosine")
    if warmup < 0 or total < 1 or not 0 <= min_ratio <= 1:
        raise ValueError("warmup, total ou min_ratio invalide")
    if step < warmup:
        return base * float(step + 1) / float(max(warmup, 1))
    if total <= warmup:
        return base
    progress = (step - warmup) / float(total - warmup)
    cosine = 0.5 * (1.0 + math.cos(math.pi * min(max(progress, 0.0), 1.0)))
    floor = base * min_ratio
    return floor + (base - floor) * cosine


def split_ids(ids: np.ndarray, val_ratio: float = 0.1) -> tuple[np.ndarray, np.ndarray]:
    if not 0 < val_ratio < 0.5:
        raise ValueError("val_ratio doit être entre 0 et 0.5")
    cut = max(1, min(len(ids) - 1, int(len(ids) * (1.0 - val_ratio))))
    return ids[:cut], ids[cut:]


def sample_batch(
    ids: np.ndarray, block: int, batch: int, rng: np.random.Generator
) -> np.ndarray:
    if len(ids) <= block:
        raise ValueError("le corpus est plus court que le bloc")
    starts = rng.integers(0, len(ids) - block, size=batch)
    return np.stack([ids[start : start + block + 1] for start in starts])


def corpus_loss(
    model: TinyGPT,
    ids: np.ndarray,
    block: int,
    max_windows: int | None = None,
    spread: bool = False,
) -> float:
    if len(ids) <= block:
        raise ValueError("pas assez de tokens pour évaluer")
    starts = list(range(0, len(ids) - block, block))
    if max_windows is not None and len(starts) > max_windows:
        if spread:
            picked = np.linspace(0, len(starts) - 1, max_windows).astype(int)
            starts = [starts[int(index)] for index in picked]
        else:
            starts = starts[:max_windows]
    losses = [
        numpy_sequence_loss(model, ids[start : start + block + 1][None, :])
        for start in starts
    ]
    return float(np.average(losses, weights=[block] * len(losses)))


def _can_encode(tokenizer, prompt: str) -> bool:
    try:
        return bool(tokenizer.encode(prompt))
    except KeyError:
        return False


def clip_prompt(
    tokenizer: CharTokenizer | BPETokenizer, prompt: str, block: int
) -> np.ndarray:
    ids = tokenizer.encode(prompt)
    if not ids:
        raise ValueError("le prompt est vide")
    return np.asarray(ids[-block:], dtype=np.int64)[None, :]


def sample_text(
    model: TinyGPT,
    tokenizer: CharTokenizer | BPETokenizer,
    prompt: str,
    steps: int,
    temperature: float = 0.8,
    top_k: int | None = 10,
    seed: int = 0,
) -> str:
    prompt_ids = clip_prompt(tokenizer, prompt, model.config.block_size)
    if isinstance(tokenizer, ByteBPETokenizer):
        from model.bigram import sample_logits

        tokens = prompt_ids[0].tolist()
        rng = np.random.default_rng(seed)
        for _ in range(steps):
            logits, _ = model.forward(np.array([tokens[-model.config.block_size :]]))
            last = logits[:, -1, :].copy()
            last[:, [tokenizer.BOS, tokenizer.PAD]] = -np.inf
            token = int(
                sample_logits(last, rng, temperature=temperature, top_k=top_k)[0]
            )
            if token == tokenizer.EOS:
                break
            tokens.append(token)
        return tokenizer.decode(tokens, errors="replace")
    tokens = generate(
        model,
        prompt_ids,
        steps,
        np.random.default_rng(seed),
        temperature=temperature,
        top_k=top_k,
    )
    return tokenizer.decode(tokens[0].tolist())


def save_checkpoint(
    path: Path, model: TinyGPT, tokenizer: CharTokenizer, history: dict
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload: dict[str, np.ndarray] = {}
    for name, value in model.params.items():
        payload["p_" + name.replace(".", "__")] = np.asarray(value, dtype=np.float64)
    if isinstance(tokenizer, ByteBPETokenizer):
        tokenizer_meta = tokenizer.to_dict()
    elif isinstance(tokenizer, BPETokenizer):
        tokenizer_meta = {"kind": "bpe", "bpe": tokenizer.to_dict()}
    else:
        tokenizer_meta = {"kind": "char", "stoi": tokenizer.stoi}
    meta = {
        "config": asdict(model.config),
        "history": history,
        "tokenizer": tokenizer_meta,
        "stoi": tokenizer_meta.get("stoi", {}),
    }
    if hasattr(model, "sft_lineage"):
        meta["sft_lineage"] = model.sft_lineage
    state = getattr(model, "training_state", None)
    if state:
        meta["training_state"] = {
            key: value
            for key, value in state.items()
            if key not in ("moment", "velocity")
        }
        for kind in ("moment", "velocity"):
            for name, value in state[kind].items():
                payload[f"o_{kind}_{name.replace('.', '__')}"] = value
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
    tokenizer_meta = meta.get("tokenizer") or {"kind": "char", "stoi": meta["stoi"]}
    if tokenizer_meta.get("kind") == "byte-bpe":
        tokenizer = ByteBPETokenizer.from_dict(tokenizer_meta)
    elif tokenizer_meta.get("kind") == "bpe":
        tokenizer = BPETokenizer.from_dict(tokenizer_meta["bpe"])
    else:
        tokenizer = CharTokenizer.from_stoi(
            {str(char): int(index) for char, index in tokenizer_meta["stoi"].items()}
        )
    if meta.get("training_state"):
        state = meta["training_state"]
        for kind in ("moment", "velocity"):
            state[kind] = {
                name: np.array(
                    archive[f"o_{kind}_{name.replace('.', '__')}"], copy=True
                )
                for name in model.params
            }
        model.training_state = state
    if meta.get("sft_lineage"):
        model.sft_lineage = meta["sft_lineage"]
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
    learning_rate: float
    schedule: str
    warmup_steps: int
    grad_clip: float
    weight_decay: float
    batch_size: int
    provenance: dict


def _attention_snapshot(model: TinyGPT, tokenizer: CharTokenizer, prompt: str) -> dict:
    model.keep_attention = True
    try:
        ids = clip_prompt(tokenizer, prompt, model.config.block_size)
        model.forward(ids)
        weights = np.asarray(model._last_weights[0][0, 0], dtype=np.float64)
    finally:
        model.keep_attention = False
    tokens = (
        [tokenizer.pieces.get(int(i), b"<special>").hex() for i in ids[0]]
        if isinstance(tokenizer, ByteBPETokenizer)
        else [tokenizer.itos[int(index)] for index in ids[0]]
    )
    last = weights[-1]
    return {
        "prompt": (
            tokenizer.decode(ids[0].tolist(), errors="replace")
            if isinstance(tokenizer, ByteBPETokenizer)
            else tokenizer.decode(ids[0].tolist())
        ),
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
    tokenizer: CharTokenizer | BPETokenizer | None = None,
    on_step=None,
    eval_windows: int | None = None,
    prompts: tuple[tuple[str, float, int], ...] | None = None,
    schedule: str = "constant",
    warmup: int = 0,
    clip: float = 1.0,
    min_ratio: float = 0.1,
    eval_spread: bool = False,
    verbose: bool = False,
    sample_tokens: int = 96,
    val_text: str | None = None,
    initial_model: TinyGPT | None = None,
    resume_state: bool = False,
    total_steps: int | None = None,
    norm: str = "layer",
) -> tuple[TinyGPT, CharTokenizer | BPETokenizer, GPTTrainResult]:
    if steps < 2:
        raise ValueError("au moins deux pas pour comparer le début et la fin")
    if val_text is None:
        cut = int(len(text) * 0.9)
        train_text, validation_text = text[:cut], text[cut:]
    else:
        train_text, validation_text = text, val_text
    if tokenizer is None:
        tokenizer = CharTokenizer(train_text + "�")

    def encode_split(part):
        if isinstance(tokenizer, ByteBPETokenizer):
            return tokenizer.encode(part, bos=True, eos=True)
        try:
            return tokenizer.encode(part)
        except KeyError:
            # Alphabet fixe de train : le remplacement n'apprend aucune fusion sur val.
            vocab = (
                tokenizer.vocab
                if isinstance(tokenizer, BPETokenizer)
                else tokenizer.stoi
            )
            if "�" not in vocab:
                raise ValueError(
                    "Tokenizer sans remplacement Unicode ; entraîne-le avec fallback=True"
                )
            return tokenizer.encode("".join(c if c in vocab else "�" for c in part))

    train_ids = np.asarray(encode_split(train_text), dtype=np.int64)
    val_ids = np.asarray(encode_split(validation_text), dtype=np.int64)
    if len(val_ids) <= block or len(train_ids) <= block:
        raise ValueError("train et val doivent contenir plus d'un bloc")
    config = GPTConfig(
        vocab_size=tokenizer.vocab_size,
        d_model=d_model,
        n_heads=n_heads,
        n_layers=n_layers,
        block_size=block,
        ffn="gelu",
        norm=norm,
        pos="absolute",
        seed=seed,
    )
    if initial_model is not None and asdict(initial_model.config) != asdict(config):
        raise ValueError("configuration incompatible avec le modèle à poursuivre")
    model = initial_model if initial_model is not None else TinyGPT(config)
    params = bind_parameters(model)
    optimizer = AdamW(params, lr=lr, weight_decay=weight_decay)
    rng = np.random.default_rng(seed)
    provenance = {
        "train_sha256": hashlib.sha256(train_text.encode()).hexdigest(),
        "val_sha256": hashlib.sha256(validation_text.encode()).hexdigest(),
        "python": platform.python_version(),
        "numpy": np.__version__,
        "split": (
            "documents explicites"
            if val_text is not None
            else "90/10 caractères avant encodage"
        ),
    }
    if isinstance(tokenizer, ByteBPETokenizer):
        provenance["unknown_train_chars"] = provenance["unknown_val_chars"] = 0
    else:
        alphabet = (
            tokenizer.vocab if isinstance(tokenizer, BPETokenizer) else tokenizer.stoi
        )
        provenance["unknown_train_chars"] = sum(c not in alphabet for c in train_text)
        provenance["unknown_val_chars"] = sum(
            c not in alphabet for c in validation_text
        )
    previous = getattr(model, "training_state", None) if resume_state else None
    if resume_state and previous is None:
        raise ValueError(
            "ce checkpoint ne contient pas un état complet de reprise ; utiliser une nouvelle phase explicite"
        )
    offset = 0
    planned = total_steps or steps
    recipe = {
        "lr": lr,
        "batch": batch,
        "schedule": schedule,
        "warmup": warmup,
        "clip": clip,
        "weight_decay": weight_decay,
        "min_ratio": min_ratio,
        "train": provenance["train_sha256"],
        "val": provenance["val_sha256"],
    }
    if previous:
        if previous["recipe"] != recipe:
            raise ValueError(
                "la recette ou les données diffèrent du checkpoint de reprise"
            )
        offset = previous["step"]
        planned = previous["planned"]
        if total_steps is not None and total_steps != planned:
            raise ValueError("total_steps différent du calendrier sauvegardé")
        optimizer.step_index = previous["optimizer_step"]
        for name in params:
            optimizer.moment[name] = previous["moment"][name].copy()
            optimizer.velocity[name] = previous["velocity"][name].copy()
        rng.bit_generator.state = previous["rng"]
    if planned < offset + steps:
        raise ValueError("le nombre total de pas prévu est dépassé")
    train_start = corpus_loss(model, train_ids, block, eval_windows, spread=eval_spread)
    val_start = corpus_loss(model, val_ids, block, eval_windows, spread=eval_spread)
    batch_losses: list[float] = []
    val_losses: list[float] = []
    val_steps: list[int] = []
    started = time.perf_counter()
    for step in range(steps):
        optimizer.lr = scheduled_lr(
            offset + step, planned, lr, warmup, schedule, min_ratio
        )
        for tensor in params.values():
            tensor.zero_grad()
        window = sample_batch(train_ids, block, batch, rng)
        loss = sequence_loss(params, window, config)
        loss.backward()
        if not np.isfinite(loss.data):
            raise FloatingPointError(f"perte non finie au pas {step}")
        optimizer.step(clip=clip)
        batch_losses.append(float(loss.data))
        if on_step is not None:
            on_step(step, batch_losses[-1])
        if step % val_every == 0 or step == steps - 1:
            val_losses.append(
                corpus_loss(model, val_ids, block, eval_windows, spread=eval_spread)
            )
            val_steps.append(step)
            if verbose:
                print(
                    f"step {step} batch {batch_losses[-1]:.3f} val {val_losses[-1]:.3f} lr {optimizer.lr:.6f}",
                    flush=True,
                )
    model.training_state = {
        "step": offset + steps,
        "planned": planned,
        "optimizer_step": optimizer.step_index,
        "moment": optimizer.moment,
        "velocity": optimizer.velocity,
        "rng": rng.bit_generator.state,
        "recipe": recipe,
    }
    seconds = time.perf_counter() - started
    train_end = corpus_loss(model, train_ids, block, eval_windows, spread=eval_spread)
    val_end = corpus_loss(model, val_ids, block, eval_windows, spread=eval_spread)
    samples: list[dict] = []
    attention = {
        "prompt": "",
        "layer": 0,
        "head": 0,
        "tokens": [],
        "last_row": [],
        "matrix": [],
    }
    if sample:
        chosen_prompts = prompts or (
            ("le chat ", 0.8, 8),
            ("le chien ", 0.6, 5),
            ("le loup ", 0.3, 3),
        )
        for prompt, temperature, top_k in chosen_prompts:
            if not _can_encode(tokenizer, prompt):
                continue
            samples.append(
                {
                    "prompt": prompt,
                    "temperature": temperature,
                    "top_k": top_k,
                    "text": sample_text(
                        model,
                        tokenizer,
                        prompt,
                        steps=sample_tokens,
                        temperature=temperature,
                        top_k=top_k,
                        seed=seed,
                    ),
                }
            )
        probe = "le chat " if _can_encode(tokenizer, "le chat ") else text[:12]
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
        learning_rate=lr,
        schedule=schedule,
        warmup_steps=warmup,
        grad_clip=clip,
        weight_decay=weight_decay,
        batch_size=batch,
        provenance=provenance,
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
        "learning_rate": result.learning_rate,
        "schedule": result.schedule,
        "warmup_steps": result.warmup_steps,
        "grad_clip": result.grad_clip,
        "weight_decay": result.weight_decay,
        "batch_size": result.batch_size,
        "provenance": result.provenance,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Entraîne le petit GPT français du dépôt."
    )
    parser.add_argument("--resume", type=Path, default=None)
    parser.add_argument("--total-steps", type=int, default=None)
    parser.add_argument("--validation", type=Path, default=None)
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
    parser.add_argument("--norm", choices=["layer", "rms"], default="layer")
    parser.add_argument(
        "--test-final",
        action="store_true",
        help="Mesure une seule fois le test réservé de la dernière phase SFT",
    )
    parser.add_argument(
        "--dataset",
        default=None,
        help="id préparé par python -m model.datasets prepare",
    )
    parser.add_argument(
        "--plan", type=Path, default=None, help="JSON d'étapes pretrain puis sft"
    )
    parser.add_argument(
        "--bpe-merges",
        type=int,
        default=0,
        help="si > 0, entraîne un BPE au lieu du tokenizer caractère",
    )
    parser.add_argument("--bpe", type=Path, default=None, help="BPE déjà sauvegardé")
    parser.add_argument(
        "--byte-bpe",
        type=int,
        default=None,
        metavar="FUSIONS",
        help="BPE octets UTF-8 ; 0 conserve les 256 octets et BOS/EOS/PAD",
    )
    parser.add_argument(
        "--eval-windows",
        type=int,
        default=0,
        help="plafonne l'évaluation, 0 = corpus entier",
    )
    args = parser.parse_args()
    if args.byte_bpe is not None and (args.bpe is not None or args.bpe_merges):
        parser.error("Choisis un seul type de tokenizer")
    if args.resume is not None and (
        args.bpe is not None or args.bpe_merges or args.byte_bpe is not None
    ):
        parser.error(
            "La reprise conserve le tokenizer du checkpoint ; ne fournis pas un nouveau tokenizer"
        )
    if args.plan is not None:
        _run_plan(args)
        return
    val_text = args.validation.read_text(encoding="utf-8") if args.validation else None
    if args.dataset:
        from model.datasets import prepared_splits

        text, val_text = prepared_splits(args.dataset)
    else:
        text = args.data.read_text(encoding="utf-8")
    tokenizer = None
    if args.byte_bpe is not None:
        tokenizer = ByteBPETokenizer.train(
            text if val_text is not None else text[: int(len(text) * 0.9)],
            args.byte_bpe,
        )
    elif args.bpe is not None:
        tokenizer = BPETokenizer.load(args.bpe)
    elif args.bpe_merges > 0:
        tokenizer = BPETokenizer.train(
            text if val_text is not None else text[: int(len(text) * 0.9)],
            args.bpe_merges,
            fallback=True,
        )
    previous_model = None
    if args.resume is not None:
        previous_model, tokenizer, _ = load_checkpoint(args.resume)
    model, tokenizer, result = train_gpt(
        text,
        initial_model=previous_model,
        resume_state=args.resume is not None,
        total_steps=args.total_steps,
        norm=args.norm,
        val_text=val_text,
        steps=args.steps,
        lr=args.lr,
        batch=args.batch,
        block=args.block,
        d_model=args.d_model,
        n_heads=args.heads,
        n_layers=args.layers,
        seed=args.seed,
        tokenizer=tokenizer,
        eval_windows=args.eval_windows or None,
    )
    corpus_label = args.dataset or str(
        args.data.relative_to(ROOT) if args.data.is_relative_to(ROOT) else args.data
    )
    history = result_payload(result, corpus_label)
    history["tokenizer_kind"] = (
        "byte-bpe"
        if isinstance(tokenizer, ByteBPETokenizer)
        else "bpe" if isinstance(tokenizer, BPETokenizer) else "char"
    )
    if isinstance(tokenizer, BPETokenizer):
        history["bpe_merges"] = len(tokenizer.merges)
    save_checkpoint(args.checkpoint, model, tokenizer, history)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(history, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"train {result.train_loss_start:.3f} -> {result.train_loss_end:.3f} | "
        f"val {result.val_loss_start:.3f} -> {result.val_loss_end:.3f} | "
        f"{result.seconds:.1f}s | {result.parameter_count} paramètres"
    )
    for sample in result.samples:
        print("---", sample["prompt"], sample["temperature"], sample["top_k"])
        print(sample["text"])


def _run_plan(args) -> None:
    """Enchaîne des jeux préparés. mode pretrain puis sft, dans l'ordre du fichier."""
    from model.datasets import prepared_splits
    from model.finetune import finetune_phase, evaluate_instructions

    plan = json.loads(args.plan.read_text(encoding="utf-8"))
    items = plan["items"] if isinstance(plan, dict) else plan
    model = None
    tokenizer = None
    if getattr(args, "resume", None) is not None:
        model, tokenizer, _ = load_checkpoint(args.resume)
    reports = []
    reserved_test = None
    for item in items:
        mode = item.get("mode", "pretrain")
        if mode == "pretrain":
            if model is not None and getattr(model, "sft_lineage", None):
                raise ValueError(
                    "Place les pré-entraînements avant le SFT : les ensembles réservés du SFT doivent rester protégés"
                )
            if item.get("id"):
                text, val_text = prepared_splits(item["id"])
            else:
                text = Path(item["text"]).read_text(encoding="utf-8")
                val_text = (
                    Path(item["validation"]).read_text(encoding="utf-8")
                    if item.get("validation")
                    else None
                )
            byte_merges = item.get("byte_bpe", getattr(args, "byte_bpe", None))
            if tokenizer is None and byte_merges is not None:
                tokenizer = ByteBPETokenizer.train(
                    text if val_text is not None else text[: int(len(text) * 0.9)],
                    byte_merges,
                )
            elif tokenizer is None and item.get("bpe_merges"):
                tokenizer = BPETokenizer.train(
                    text if val_text is not None else text[: int(len(text) * 0.9)],
                    int(item["bpe_merges"]),
                    fallback=True,
                )
            model, tokenizer, result = train_gpt(
                text,
                val_text=val_text,
                initial_model=model,
                norm=item.get("norm", getattr(args, "norm", "layer")),
                steps=int(item.get("steps", args.steps)),
                lr=float(item.get("lr", args.lr)),
                batch=int(item.get("batch", args.batch)),
                block=int(item.get("block", args.block)),
                d_model=int(item.get("d_model", args.d_model)),
                n_heads=int(item.get("heads", args.heads)),
                n_layers=int(item.get("layers", args.layers)),
                seed=args.seed,
                tokenizer=tokenizer,
                eval_windows=int(item.get("eval_windows", args.eval_windows or 0))
                or None,
                sample=bool(item.get("sample", False)),
            )
            reports.append(
                {
                    "id": item.get("id"),
                    "mode": mode,
                    "train_loss_end": result.train_loss_end,
                    "val_loss_end": result.val_loss_end,
                }
            )
        elif mode == "sft":
            if model is None or tokenizer is None:
                raise ValueError("le plan SFT arrive avant un pré-entraînement")
            tuned, reserved_test = finetune_phase(
                model, tokenizer, item, seed=args.seed
            )
            reports.append({"id": item.get("id"), "mode": mode, **tuned})
        else:
            raise ValueError(mode)
    if getattr(args, "test_final", False):
        if not reserved_test or reports[-1]["mode"] != "sft":
            raise ValueError(
                "le test final nécessite une dernière phase SFT avec test réservé"
            )
        reports[-1]["test_final"] = evaluate_instructions(
            model, tokenizer, reserved_test
        )
        reports[-1]["test_consulted"] = True
    if model is not None and tokenizer is not None:
        save_checkpoint(args.checkpoint, model, tokenizer, {"plan": reports})
    if getattr(args, "report", None):
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(
            json.dumps(
                {"format": "afz-training-plan-v1", "items": reports},
                ensure_ascii=False,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
    print(json.dumps(reports, ensure_ascii=False))


if __name__ == "__main__":
    main()
